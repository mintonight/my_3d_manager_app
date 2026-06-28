from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db
from ..models import Comment, Notification, User
from ..schemas import NotificationOut


router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def _mention_out(
    notification: Notification,
    comment: Comment,
    author: User,
) -> NotificationOut:
    # Mention notifications derive project/file/content/author from the comment.
    return NotificationOut(
        id=notification.id,
        user_id=notification.user_id,
        comment_id=notification.comment_id,
        project_id=comment.project_id,
        file_id=comment.file_id,
        file_version_id=comment.file_version_id,
        type=notification.type,
        is_read=notification.is_read,
        comment_content=comment.content,
        author_username=author.username,
        created_at=notification.created_at,
    )


def _download_out(notification: Notification, actor: User) -> NotificationOut:
    # Download notifications carry their own context; comment_content reuses the
    # message text so the frontend renders both kinds from one shape.
    return NotificationOut(
        id=notification.id,
        user_id=notification.user_id,
        comment_id=None,
        project_id=notification.project_id,  # type: ignore[arg-type]
        file_id=notification.file_id,
        file_version_id=notification.file_version_id,
        type=notification.type,
        is_read=notification.is_read,
        comment_content=notification.message or "",
        author_username=actor.username,
        created_at=notification.created_at,
    )


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[NotificationOut]:
    mention_rows = (
        db.query(Notification, Comment, User)
        .join(Comment, Comment.id == Notification.comment_id)
        .join(User, User.id == Comment.author_id)
        .filter(Notification.user_id == user.id)
        .all()
    )
    download_rows = (
        db.query(Notification, User)
        .join(User, User.id == Notification.actor_id)
        .filter(Notification.user_id == user.id, Notification.comment_id.is_(None))
        .all()
    )
    items = [_mention_out(n, comment, author) for n, comment, author in mention_rows]
    items.extend(_download_out(n, actor) for n, actor in download_rows)
    return sorted(
        items,
        key=lambda item: (item.is_read, -item.created_at.timestamp(), item.id),
    )


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationOut:
    notification = db.get(Notification, notification_id)
    if not notification:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "notification not found")
    if notification.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "cannot update this notification")

    notification.is_read = True
    db.commit()
    db.refresh(notification)

    if notification.comment_id is not None:
        comment = db.get(Comment, notification.comment_id)
        if not comment:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "comment not found")
        author = db.get(User, comment.author_id)
        if not author:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "comment author not found")
        return _mention_out(notification, comment, author)

    actor = db.get(User, notification.actor_id)
    if not actor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "notification actor not found")
    return _download_out(notification, actor)
