"""Service for creating project-level commits (git-style snapshots).

A commit freezes the current state of every non-deleted file in a project:
each file's current version is recorded in a tree (ProjectCommitFile rows).
This is the equivalent of `git add -A && git commit`.
"""

from sqlalchemy.orm import Session

from .models import File as FileModel, Project, ProjectCommit, ProjectCommitFile, User


def create_commit(
    db: Session,
    project: Project,
    author: User,
    message: str,
) -> ProjectCommit:
    """Snapshot the project's current file state into a new commit.

    Records one ProjectCommitFile entry per non-deleted file, capturing the
    file_id and its current_version_id at this moment. Updates the project's
    HEAD pointer to the new commit.
    """
    commit = ProjectCommit(
        project_id=project.id,
        author_id=author.id,
        message=message,
    )
    db.add(commit)
    db.flush()  # get commit.id

    active_files = (
        db.query(FileModel)
        .filter(FileModel.project_id == project.id, FileModel.is_deleted.is_(False))
        .all()
    )
    for f in active_files:
        if not f.current_version_id:
            continue
        db.add(
            ProjectCommitFile(
                commit_id=commit.id,
                file_id=f.id,
                file_version_id=f.current_version_id,
            )
        )

    project.head_commit_id = commit.id
    db.flush()
    return commit


def backfill_initial_commits(db: Session) -> int:
    """Ensure every project has at least one commit (HEAD).

    For projects created before the snapshot feature, create an "initial
    snapshot" commit from their current file state. Returns the count of
    commits created.
    """
    projects = db.query(Project).all()
    created = 0
    for project in projects:
        if project.head_commit_id is not None:
            continue
        owner = db.get(User, project.owner_id)
        if owner is None:
            continue
        create_commit(db, project, owner, "初始快照")
        created += 1
    if created:
        db.commit()
    return created
