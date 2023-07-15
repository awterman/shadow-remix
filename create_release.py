import argparse
from collections import namedtuple
import json
import os
import shutil
from git import Repo
import requests
import tomllib
from os.path import normpath
import tempfile

VERSION_FILE = normpath("./src-tauri/tauri.conf.json")
RELEASE_TARGET = normpath("./src-tauri/target/release/shadow.exe")
THIRD_PARTY_DIR = normpath("./third_party")
DATA_DIR = normpath("./data")

MAJOR = 0
MINOR = 1
PATCH = 2


GiteaConf = namedtuple("GiteaConf", ["url", "token"])


class Gitea:
    def __init__(self, url: str, token: str):
        self.url = url
        self.token = token

    def request(self, method: str, path: str, **kwargs):
        return requests.request(
            method,
            f"{self.url}{path}",
            headers={"Authorization": f"token {self.token}"},
            **kwargs,
        )

    def get(self, path: str, **kwargs):
        return self.request("GET", path, **kwargs)

    def post(self, path: str, **kwargs):
        return self.request("POST", path, **kwargs)

    def create_release(self, owner: str, repo: str, tag_name: str, name: str):
        body = f"Release for version {tag_name}"
        resp = self.post(
            f"/api/v1/repos/{owner}/{repo}/releases",
            json={
                "tag_name": tag_name,
                "name": name,
                "body": body,
            },
        )
        resp.raise_for_status()
        return resp.json()["id"]

    def upload_asset(self, owner: str, repo: str, release_id: int, file_path: str):
        resp = self.post(
            f"/api/v1/repos/{owner}/{repo}/releases/{release_id}/assets",
            files={"attachment": open(file_path, "rb")},
        )
        resp.raise_for_status()


class GitHandler:
    def __init__(self, repo: Repo):
        self.repo = repo

    def assert_clean(self):
        if self.repo.is_dirty():
            raise Exception("Git repository is dirty")

    def add(self, path: str):
        self.repo.index.add([path])

    def commit(self, message: str):
        self.repo.index.commit(message)

    def push(self):
        self.repo.remotes.origin.push()


def get_version() -> str:
    # JSON fields: { "package": { "version": "0.1.0" } }
    with open(VERSION_FILE, "r") as f:
        return json.load(f)["package"]["version"]


def set_version(version: str):
    # JSON fields: { "package": { "version": "0.1.0" } }
    with open(VERSION_FILE, "r") as f:
        data = json.load(f)
        data["package"]["version"] = version

    with open(VERSION_FILE, "w") as f:
        json.dump(data, f, indent=2)


def increase_version(version: str, index) -> str:
    version = version.split(".")
    version[index] = str(int(version[index]) + 1)
    return ".".join(version)


def read_gitea_conf() -> GiteaConf:
    with open(os.path.expanduser("~/.config/gitea_token.toml"), "rb") as f:
        config = tomllib.load(f)

    return GiteaConf(
        url=config["gitea"]["url"],
        token=config["gitea"]["token"],
    )


def publish_release(version: str, release_file: str):
    # create Gitea client
    conf = read_gitea_conf()
    gitea = Gitea(conf.url, conf.token)

    # create release
    release_id = gitea.create_release(
        "shadow",
        "shadow",
        version,
        f"Release for version {version}",
    )

    print(f"Release created with id {release_id}")

    # upload asset
    gitea.upload_asset(
        "shadow",
        "shadow",
        release_id,
        release_file,
    )

    print("Asset uploaded")


# pack the executable and dependencies into a zip file
def pack_release(version):
    with tempfile.TemporaryDirectory() as tmpdir:
        # copy executable
        shutil.copy(RELEASE_TARGET, tmpdir)
        # copy third-party dependencies
        shutil.copytree(THIRD_PARTY_DIR, os.path.join(tmpdir, "third-party"))
        # copy data
        shutil.copytree(DATA_DIR, os.path.join(tmpdir, "data"))

        # zip
        shutil.make_archive(f"shadow-{version}", "zip", tmpdir)

    return f"shadow-{version}.zip"


def main(change_type: int):
    # assert clean git repo
    repo = Repo(".")
    git = GitHandler(repo)
    git.assert_clean()

    # increase version number
    version = get_version()
    version = increase_version(version, change_type)
    set_version(version)
    print(f"Version increased to {version}")

    # build tauri app
    print("Building tauri app...")
    os.system("cargo tauri build")

    # pack release
    print("Packing release...")
    release_file = pack_release(version)

    # commit and push
    git.add(VERSION_FILE)
    git.commit(f"Version increased to {version}")
    git.push()

    # publish release
    publish_release(version, release_file)

    # cleanup
    os.remove(release_file)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "change_type",
        type=str,
        choices=["major", "minor", "patch"] + ["0", "1", "2"],
        help="The type of change to make to the version number, 0: major, 1: minor, 2: patch",
    )
    args = parser.parse_args()

    if args.change_type == "major":
        change_type = MAJOR
    elif args.change_type == "minor":
        change_type = MINOR
    elif args.change_type == "patch":
        change_type = PATCH
    else:
        change_type = int(args.change_type)

    return change_type


if __name__ == "__main__":
    main(parse_args())
