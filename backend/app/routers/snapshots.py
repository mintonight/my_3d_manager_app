"""Project snapshot endpoints (git-style commit history + rollback).

A snapshot is a project-level commit that froze the state of every file at a
point in time. Rolling back moves the project's HEAD pointer to an older
snapshot and restores the file list / version pointers recorded in that
snapshot's tree.
"""

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from urllib.parse import quote

from ..deps import get_db, require_project_role, get_project_or_404
from ..models import (
    File as FileModel,
    FileVersion,
    Project,
    ProjectCommit,
    ProjectCommitFile,
    User,
)
from ..schemas import SnapshotListItemOut, SnapshotOut, SnapshotFileOut
from ..storage import get_blob_path


router = APIRouter(prefix="/api/projects/{pid}/snapshots", tags=["snapshots"])


def _snapshot_list_item(
    commit: ProjectCommit, author_username: str, is_head: bool, file_count: int
) -> SnapshotListItemOut:
    return SnapshotListItemOut(
        id=commit.id,
        author_id=commit.author_id,
        author_username=author_username,
        message=commit.message,
        created_at=commit.created_at,
        is_head=is_head,
        file_count=file_count,
    )


@router.get("", response_model=list[SnapshotListItemOut])
def list_snapshots(
    ctx: tuple[Project, User, str] = Depends(require_project_role("viewer")),
    db: Session = Depends(get_db),
) -> list[SnapshotListItemOut]:
    """List all commits for a project (= git log), newest first."""
    p, _, _ = ctx
    commits = (
        db.query(ProjectCommit, User)
        .join(User, User.id == ProjectCommit.author_id)
        .filter(ProjectCommit.project_id == p.id)
        .order_by(ProjectCommit.created_at.desc(), ProjectCommit.id.desc())
        .all()
    )
    head_id = p.head_commit_id
    result: list[SnapshotListItemOut] = []
    for commit, author in commits:
        file_count = (
            db.query(ProjectCommitFile)
            .filter(ProjectCommitFile.commit_id == commit.id)
            .count()
        )
        result.append(
            _snapshot_list_item(commit, author.username, commit.id == head_id, file_count=file_count)
        )
    return result


def _get_commit_or_404(commit_id: int, project_id: int, db: Session) -> ProjectCommit:
    commit = db.get(ProjectCommit, commit_id)
    if not commit or commit.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "snapshot not found")
    return commit


@router.get("/{commit_id}", response_model=SnapshotOut)
def get_snapshot(
    commit_id: int,
    ctx: tuple[Project, User, str] = Depends(require_project_role("viewer")),
    db: Session = Depends(get_db),
) -> SnapshotOut:
    """Get a single snapshot with its full file tree."""
    p, _, _ = ctx
    commit = _get_commit_or_404(commit_id, p.id, db)
    author = db.get(User, commit.author_id)

    tree_rows = (
        db.query(ProjectCommitFile, FileModel, FileVersion)
        .join(FileModel, FileModel.id == ProjectCommitFile.file_id)
        .join(FileVersion, FileVersion.id == ProjectCommitFile.file_version_id)
        .filter(ProjectCommitFile.commit_id == commit.id)
        .order_by(FileModel.name.asc())
        .all()
    )
    files = [
        SnapshotFileOut(
            file_id=f.id,
            file_name=f.name,
            file_version_id=v.id,
            version_no=v.version_no,
            size_bytes=v.size_bytes,
        )
        for _, f, v in tree_rows
    ]
    return SnapshotOut(
        id=commit.id,
        project_id=commit.project_id,
        author_id=commit.author_id,
        author_username=author.username if author else "",
        message=commit.message,
        created_at=commit.created_at,
        is_head=(commit.id == p.head_commit_id),
        file_count=len(files),
        files=files,
    )


@router.post("/{commit_id}/rollback")
def rollback_to_snapshot(
    commit_id: int,
    ctx: tuple[Project, User, str] = Depends(require_project_role("editor")),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Soft-rollback: move HEAD to an older snapshot.

    - Restores files that existed in the snapshot but were since deleted.
    - Hides files that were added after the snapshot.
    - Resets each file's current_version_id to the version recorded in the
      snapshot's tree (parts and assemblies move together).

    History is preserved; rolling back then uploading creates a new commit.
    """
    p, _, _ = ctx
    commit = _get_commit_or_404(commit_id, p.id, db)

    # The snapshot's tree: file_id -> version_id it should point to.
    tree_rows = (
        db.query(ProjectCommitFile)
        .filter(ProjectCommitFile.commit_id == commit.id)
        .all()
    )
    tree_version_by_file: dict[int, int] = {
        row.file_id: row.file_version_id for row in tree_rows
    }

    # All files belonging to the project (active or soft-deleted).
    all_files = db.query(FileModel).filter(FileModel.project_id == p.id).all()
    for f in all_files:
        if f.id in tree_version_by_file:
            # File existed in the snapshot: restore + set its version pointer.
            f.is_deleted = False
            f.current_version_id = tree_version_by_file[f.id]
        else:
            # File did not exist in the snapshot: hide it.
            f.is_deleted = True

    p.head_commit_id = commit.id
    db.commit()
    return {"status": "rolled back", "commit_id": str(commit.id)}


@router.get("/{commit_id}/download")
def download_snapshot(
    commit_id: int,
    ctx: tuple[Project, User, str] = Depends(require_project_role("viewer")),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Download the full file tree of a snapshot as a zip."""
    # Reuse the project router's zip streaming helper to avoid duplication.
    from .projects import _stream_zip

    p, _, _ = ctx
    commit = _get_commit_or_404(commit_id, p.id, db)

    tree_rows = (
        db.query(ProjectCommitFile, FileModel, FileVersion)
        .join(FileModel, FileModel.id == ProjectCommitFile.file_id)
        .join(FileVersion, FileVersion.id == ProjectCommitFile.file_version_id)
        .filter(ProjectCommitFile.commit_id == commit.id)
        .order_by(FileModel.name.asc())
        .all()
    )
    entries: list[tuple[str, Path]] = []
    for _, f, v in tree_rows:
        try:
            entries.append((f.name, get_blob_path(v.blob_hash)))
        except FileNotFoundError:
            continue

    encoded = quote(f"{p.name}-snapshot-{commit.id}.zip")
    return StreamingResponse(
        _stream_zip(entries),
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=project_snapshot_{commit.id}.zip; filename*=UTF-8''{encoded}"
        },
    )
