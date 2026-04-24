from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


Role = Literal["owner", "editor", "viewer"]
UiLanguage = Literal["zh-CN", "en-US"]
UiTheme = Literal["light", "dark"]


class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    is_admin: bool
    ui_language: UiLanguage
    ui_theme: UiTheme
    edrawings_exe_path: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class UserSettingsUpdate(BaseModel):
    ui_language: UiLanguage | None = None
    ui_theme: UiTheme | None = None
    edrawings_exe_path: str | None = Field(default=None, max_length=512)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: str = Field(default="", max_length=512)


class ProjectOut(BaseModel):
    id: int
    name: str
    description: str
    owner_id: int
    created_at: datetime
    my_role: Role

    class Config:
        from_attributes = True


class MemberAdd(BaseModel):
    username: str
    role: Role = "viewer"


class MemberUpdate(BaseModel):
    role: Role


class MemberOut(BaseModel):
    user_id: int
    username: str
    email: EmailStr
    role: Role


class FileOut(BaseModel):
    id: int
    name: str
    current_version_no: int | None
    current_version_id: int | None
    created_at: datetime


class FileVersionOut(BaseModel):
    id: int
    version_no: int
    blob_hash: str
    size_bytes: int
    commit_message: str
    author_id: int
    author_username: str
    created_at: datetime
    is_current: bool


class CommitMessage(BaseModel):
    commit_message: str = Field(default="", max_length=512)


class SearchResultProjectOut(BaseModel):
    id: int
    name: str
    description: str
    owner_id: int
    created_at: datetime
    my_role: Role


class SearchResultFileOut(BaseModel):
    id: int
    name: str
    project_id: int
    project_name: str
    current_version_no: int | None
    current_version_id: int | None
    created_at: datetime


class SearchResultOut(BaseModel):
    projects: list[SearchResultProjectOut]
    files: list[SearchResultFileOut]


class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    mentioned_user_ids: list[int] = Field(default_factory=list)


class CommentOut(BaseModel):
    id: int
    project_id: int
    file_id: int
    file_version_id: int | None
    author_id: int
    author_username: str
    content: str
    created_at: datetime


class NotificationOut(BaseModel):
    id: int
    user_id: int
    comment_id: int | None
    project_id: int
    file_id: int | None
    file_version_id: int | None
    type: str
    is_read: bool
    comment_content: str
    author_username: str
    created_at: datetime
