"""Initial schema.

Revision ID: 202604210001
Revises:
Create Date: 2026-04-21
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "202604210001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("email", sa.String(length=128), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("ui_language", sa.String(length=16), nullable=False, server_default="zh-CN"),
        sa.Column("ui_theme", sa.String(length=16), nullable=False, server_default="light"),
        sa.Column("edrawings_exe_path", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.String(length=512), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
    )

    op.create_table(
        "project_members",
        sa.Column("project_id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )

    op.create_table(
        "files",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("current_version_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.UniqueConstraint("project_id", "name", name="uq_file_project_name"),
    )

    op.create_table(
        "file_versions",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("file_id", sa.Integer(), nullable=False),
        sa.Column("version_no", sa.Integer(), nullable=False),
        sa.Column("blob_hash", sa.String(length=64), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("commit_message", sa.String(length=512), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"]),
        sa.UniqueConstraint("file_id", "version_no", name="uq_fileversion_no"),
    )
    op.create_foreign_key(
        "fk_file_current_version",
        "files",
        "file_versions",
        ["current_version_id"],
        ["id"],
    )

    op.create_table(
        "comments",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("file_id", sa.Integer(), nullable=False),
        sa.Column("file_version_id", sa.Integer(), nullable=True),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.String(length=2000), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"]),
        sa.ForeignKeyConstraint(["file_version_id"], ["file_versions.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
    )
    op.create_index("ix_comments_project_id", "comments", ["project_id"])
    op.create_index("ix_comments_file_id", "comments", ["file_id"])
    op.create_index("ix_comments_file_version_id", "comments", ["file_version_id"])
    op.create_index("ix_comments_author_id", "comments", ["author_id"])

    op.create_table(
        "comment_mentions",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("comment_id", sa.Integer(), nullable=False),
        sa.Column("mentioned_user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["comment_id"], ["comments.id"]),
        sa.ForeignKeyConstraint(["mentioned_user_id"], ["users.id"]),
        sa.UniqueConstraint(
            "comment_id",
            "mentioned_user_id",
            name="uq_commentmention_comment_user",
        ),
    )
    op.create_index("ix_comment_mentions_comment_id", "comment_mentions", ["comment_id"])
    op.create_index(
        "ix_comment_mentions_mentioned_user_id",
        "comment_mentions",
        ["mentioned_user_id"],
    )

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("comment_id", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["comment_id"], ["comments.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.UniqueConstraint("user_id", "comment_id", "type", name="uq_notification_user_comment_type"),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_comment_id", "notifications", ["comment_id"])

    op.create_table(
        "download_notifications",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("file_id", sa.Integer(), nullable=True),
        sa.Column("file_version_id", sa.Integer(), nullable=True),
        sa.Column("actor_id", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("message", sa.String(length=512), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"]),
        sa.ForeignKeyConstraint(["file_version_id"], ["file_versions.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index("ix_download_notifications_user_id", "download_notifications", ["user_id"])
    op.create_index("ix_download_notifications_project_id", "download_notifications", ["project_id"])
    op.create_index("ix_download_notifications_file_id", "download_notifications", ["file_id"])
    op.create_index(
        "ix_download_notifications_file_version_id",
        "download_notifications",
        ["file_version_id"],
    )
    op.create_index("ix_download_notifications_actor_id", "download_notifications", ["actor_id"])


def downgrade() -> None:
    op.drop_index("ix_download_notifications_actor_id", table_name="download_notifications")
    op.drop_index("ix_download_notifications_file_version_id", table_name="download_notifications")
    op.drop_index("ix_download_notifications_file_id", table_name="download_notifications")
    op.drop_index("ix_download_notifications_project_id", table_name="download_notifications")
    op.drop_index("ix_download_notifications_user_id", table_name="download_notifications")
    op.drop_table("download_notifications")

    op.drop_index("ix_notifications_comment_id", table_name="notifications")
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_table("notifications")

    op.drop_index("ix_comment_mentions_mentioned_user_id", table_name="comment_mentions")
    op.drop_index("ix_comment_mentions_comment_id", table_name="comment_mentions")
    op.drop_table("comment_mentions")

    op.drop_index("ix_comments_author_id", table_name="comments")
    op.drop_index("ix_comments_file_version_id", table_name="comments")
    op.drop_index("ix_comments_file_id", table_name="comments")
    op.drop_index("ix_comments_project_id", table_name="comments")
    op.drop_table("comments")

    op.drop_constraint("fk_file_current_version", "files", type_="foreignkey")
    op.drop_table("file_versions")
    op.drop_table("files")
    op.drop_table("project_members")
    op.drop_table("projects")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
