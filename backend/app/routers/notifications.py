from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db
from ..models import Comment, Notification, User
from ..schemas import NotificationOut


router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def _notification_out(
    notification: Notification,
    comment: Comment,
    author: User,
) -> NotificationOut:
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


def _get_notification_or_404(notification_id: int, db: Session) -> Notification:
    notification = db.get(Notification, notification_id)
    if not notification:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "notification not found")
    return notification


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[NotificationOut]:
    rows = (
        db.query(Notification, Comment, User)
        .join(Comment, Comment.id == Notification.comment_id)
        .join(User, User.id == Comment.author_id)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.is_read.asc(), Notification.created_at.desc(), Notification.id.desc())
        .all()
    )
    return [_notification_out(notification, comment, author) for notification, comment, author in rows]


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NotificationOut:
    notification = _get_notification_or_404(notification_id, db)
    if notification.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "cannot update this notification")

    notification.is_read = True
    db.commit()
    db.refresh(notification)

    comment = db.get(Comment, notification.comment_id)
    if not comment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "comment not found")
    author = db.get(User, comment.author_id)
    if not author:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "comment author not found")
    return _notification_out(notification, comment, author)
