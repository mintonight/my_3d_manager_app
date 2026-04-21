import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..deps import get_db, require_project_role
from ..models import Comment, CommentMention, File as FileModel, FileVersion, Notification
from ..models import Project, ProjectMember, User
from ..schemas import CommentCreate, CommentOut


router = APIRouter(prefix="/api/projects/{pid}", tags=["comments"])

MENTION_PATTERN = re.compile(r"(?<!\w)@([A-Za-z0-9_.\-\u4e00-\u9fff]{2,64})")


def _get_file_or_404(project_id: int, file_id: int, db: Session) -> FileModel:
    file = db.get(FileModel, file_id)
    if not file or file.project_id != project_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "file not found")
    return file


def _get_version_or_404(file_id: int, version_id: int, db: Session) -> FileVersion:
    version = db.get(FileVersion, version_id)
    if not version or version.file_id != file_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "version not found")
    return version


def _comment_out(comment: Comment, author: User) -> CommentOut:
    return CommentOut(
        id=comment.id,
        project_id=comment.project_id,
        file_id=comment.file_id,
        file_version_id=comment.file_version_id,
        author_id=comment.author_id,
        author_username=author.username,
        content=comment.content,
        created_at=comment.created_at,
    )


def _mentioned_users(
    db: Session,
    project_id: int,
    content: str,
    author_id: int,
) -> list[User]:
    usernames = {match.group(1) for match in MENTION_PATTERN.finditer(content)}
    if not usernames:
        return []

    rows = (
        db.query(User)
        .join(ProjectMember, ProjectMember.user_id == User.id)
        .filter(ProjectMember.project_id == project_id)
        .filter(User.username.in_(usernames))
        .all()
    )
    return [user for user in rows if user.id != author_id]


def _create_comment(
    db: Session,
    project: Project,
    author: User,
    file: FileModel,
    content: str,
    file_version_id: int | None = None,
) -> Comment:
    comment = Comment(
        project_id=project.id,
        file_id=file.id,
        file_version_id=file_version_id,
        author_id=author.id,
        content=content.strip(),
    )
    db.add(comment)
    db.flush()

    for mentioned_user in _mentioned_users(db, project.id, comment.content, author.id):
        db.add(CommentMention(comment_id=comment.id, mentioned_user_id=mentioned_user.id))
        db.add(
            Notification(
                user_id=mentioned_user.id,
                comment_id=comment.id,
                type="mention",
                is_read=False,
            )
        )

    db.commit()
    db.refresh(comment)
    return comment


def _list_comments(
    db: Session,
    project_id: int,
    file_id: int,
    file_version_id: int | None,
) -> list[CommentOut]:
    rows = (
        db.query(Comment, User)
        .join(User, User.id == Comment.author_id)
        .filter(Comment.project_id == project_id)
        .filter(Comment.file_id == file_id)
        .filter(Comment.file_version_id == file_version_id)
        .order_by(Comment.created_at.asc(), Comment.id.asc())
        .all()
    )
    return [_comment_out(comment, author) for comment, author in rows]


@router.get("/files/{fid}/comments", response_model=list[CommentOut])
def list_file_comments(
    fid: int,
    ctx: tuple[Project, User, str] = Depends(require_project_role("viewer")),
    db: Session = Depends(get_db),
) -> list[CommentOut]:
    project, _, _ = ctx
    _get_file_or_404(project.id, fid, db)
    return _list_comments(db, project.id, fid, None)


@router.post(
    "/files/{fid}/comments",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
)
def create_file_comment(
    fid: int,
    data: CommentCreate,
    ctx: tuple[Project, User, str] = Depends(require_project_role("viewer")),
    db: Session = Depends(get_db),
) -> CommentOut:
    project, user, _ = ctx
    file = _get_file_or_404(project.id, fid, db)
    comment = _create_comment(db, project, user, file, data.content)
    return _comment_out(comment, user)


@router.get("/files/{fid}/versions/{vid}/comments", response_model=list[CommentOut])
def list_version_comments(
    fid: int,
    vid: int,
    ctx: tuple[Project, User, str] = Depends(require_project_role("viewer")),
    db: Session = Depends(get_db),
) -> list[CommentOut]:
    project, _, _ = ctx
    _get_file_or_404(project.id, fid, db)
    _get_version_or_404(fid, vid, db)
    return _list_comments(db, project.id, fid, vid)


@router.post(
    "/files/{fid}/versions/{vid}/comments",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
)
def create_version_comment(
    fid: int,
    vid: int,
    data: CommentCreate,
    ctx: tuple[Project, User, str] = Depends(require_project_role("viewer")),
    db: Session = Depends(get_db),
) -> CommentOut:
    project, user, _ = ctx
    file = _get_file_or_404(project.id, fid, db)
    _get_version_or_404(fid, vid, db)
    comment = _create_comment(db, project, user, file, data.content, file_version_id=vid)
    return _comment_out(comment, user)


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: int,
    ctx: tuple[Project, User, str] = Depends(require_project_role("viewer")),
    db: Session = Depends(get_db),
) -> None:
    _, user, _ = ctx
    comment = db.get(Comment, comment_id)
    if not comment or comment.project_id != ctx[0].id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "comment not found")
    if not user.is_admin and comment.author_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "cannot delete this comment")

    db.query(Notification).filter(Notification.comment_id == comment.id).delete()
    db.query(CommentMention).filter(CommentMention.comment_id == comment.id).delete()
    db.delete(comment)
    db.commit()
