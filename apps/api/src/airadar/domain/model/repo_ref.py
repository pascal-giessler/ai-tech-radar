from dataclasses import dataclass

from airadar.domain.model.slug import slugify


@dataclass(frozen=True)
class RepoRef:
    owner: str
    name: str

    @property
    def full_name(self) -> str:
        return f"{self.owner}/{self.name}"

    @property
    def slug(self) -> str:
        return slugify(self.full_name)
