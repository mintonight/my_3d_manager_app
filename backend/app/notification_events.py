from sqlalchemy.orm import Session

from .models import DownloadNotification, File as FileModel
from .models import FileVersion, Project, ProjectMember, User


def _download_recipient_ids(db: Session, project_id: int) -> set[int]:
    member_ids = {
        row[0]
        for row in db.query(ProjectMember.user_id)
        .filter(ProjectMember.project_id == project_id)
        .all()
    }
    admin_ids = {row[0] for row in db.query(User.id).filter(User.is_admin.is_(True)).all()}
    return member_ids | admin_ids


def create_project_download_notifications(
    db: Session,
    project: Project,
    actor: User,
) -> None:
    message = f'{actor.username} downloaded project archive "{project.name}"'
    for user_id in sorted(_download_recipient_ids(db, project.id)):
        db.add(
            DownloadNotification(
                user_id=user_id,
                project_id=project.id,
                actor_id=actor.id,
                type="project_download",
                message=message,
                is_read=False,
            )
        )


def create_file_download_notifications(
    db: Session,
    project: Project,
    file: FileModel,
    version: FileVersion,
    actor: User,
) -> None:
    message = (
        f'{actor.username} downloaded file "{file.name}" '
        f'v{version.version_no} in project "{project.name}"'
    )
    for user_id in sorted(_download_recipient_ids(db, project.id)):
        db.add(
            DownloadNotification(
                user_id=user_id,
                project_id=project.id,
                file_id=file.id,
                file_version_id=version.id,
                actor_id=actor.id,
                type="file_download",
                message=message,
                is_read=False,
            )
        )
