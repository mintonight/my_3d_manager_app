from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Boolean,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ui_language: Mapped[str] = mapped_column(String(16), default="zh-CN", nullable=False)
    ui_theme: Mapped[str] = mapped_column(String(16), default="light", nullable=False)
    edrawings_exe_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    description: Mapped[str] = mapped_column(String(512), default="")
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    members: Mapped[list["ProjectMember"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class ProjectMember(Base):
    __tablename__ = "project_members"

    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    role: Mapped[str] = mapped_column(String(16))  # owner | editor | viewer

    project: Mapped["Project"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship()


class File(Base):
    __tablename__ = "files"
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_file_project_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    name: Mapped[str] = mapped_column(String(255))
    current_version_id: Mapped[int | None] = mapped_column(
        ForeignKey("file_versions.id", use_alter=True, name="fk_file_current_version"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class FileVersion(Base):
    __tablename__ = "file_versions"
    __table_args__ = (UniqueConstraint("file_id", "version_no", name="uq_fileversion_no"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    file_id: Mapped[int] = mapped_column(ForeignKey("files.id"))
    version_no: Mapped[int] = mapped_column(Integer)
    blob_hash: Mapped[str] = mapped_column(String(64))
    size_bytes: Mapped[int] = mapped_column(Integer)
    commit_message: Mapped[str] = mapped_column(String(512), default="")
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    file_id: Mapped[int] = mapped_column(ForeignKey("files.id"), index=True)
    file_version_id: Mapped[int | None] = mapped_column(
        ForeignKey("file_versions.id"),
        nullable=True,
        index=True,
    )
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    content: Mapped[str] = mapped_column(String(2000))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CommentMention(Base):
    __tablename__ = "comment_mentions"
    __table_args__ = (
        UniqueConstraint(
            "comment_id",
            "mentioned_user_id",
            name="uq_commentmention_comment_user",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    comment_id: Mapped[int] = mapped_column(ForeignKey("comments.id"), index=True)
    mentioned_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "comment_id",
            "type",
            name="uq_notification_user_comment_type",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    comment_id: Mapped[int] = mapped_column(ForeignKey("comments.id"), index=True)
    type: Mapped[str] = mapped_column(String(32), default="mention")
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DownloadNotification(Base):
    __tablename__ = "download_notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    file_id: Mapped[int | None] = mapped_column(ForeignKey("files.id"), nullable=True, index=True)
    file_version_id: Mapped[int | None] = mapped_column(
        ForeignKey("file_versions.id"),
        nullable=True,
        index=True,
    )
    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[str] = mapped_column(String(32), default="project_download")
    message: Mapped[str] = mapped_column(String(512))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
