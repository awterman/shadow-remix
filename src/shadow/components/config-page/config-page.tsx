import { open } from "@tauri-apps/api/dialog";
import { useEffect, useState } from "react";
import { fs } from "shadow/core/apis";
import { configs, singletons } from "shadow/singletons";
import tw from "tailwind-styled-components";
import { BaiduLogin } from "./baidu-login";
import {
  Button,
  Container,
  Divider,
  Input,
  Modal,
  Panel,
  Row as BaseRow,
  Text,
  WarnText,
} from "../general";
import { Entry } from "shadow/core/config";

const ConfigPanel = ({ children }: { children: React.ReactNode }) => {
  return <Panel className="items-center">{children}</Panel>;
};

const Row = tw(BaseRow)`
    w-[20em]
`;

const ConfigInput = (props: {
  configEntry: Entry;
  value: string;
  setValue: (value: string) => void;
}) => {
  useEffect(() => {
    (async () => {
      const value = await props.configEntry.get();
      if (value) {
        props.setValue(value);
      }
    })();
  }, []);

  const { configEntry, setValue, ...rest } = props;

  return (
    <Input
      type="text"
      onChange={(e) => props.setValue(e.target.value)}
      {...rest}
    />
  );
};

const LocalDirConfig = (props: { configEntry: Entry }) => {
  const [path, setPath] = useState("");
  const [valid, setValid] = useState(false);

  async function setAndCheck(path: string) {
    setPath(path);
    const ok = await fs.exists(path);
    setValid(ok);

    if (ok) {
      props.configEntry.set(path);
    }
  }

  async function openDialog() {
    const path = await open({
      multiple: false,
      directory: true,
    });
    if (path) {
      setAndCheck(path as string);
    }
  }

  return (
    <>
      <ConfigInput value={path} setValue={setAndCheck} {...props} />
      <Button onClick={openDialog}> 浏览 </Button>
      {!valid && <WarnText> 无效路径 </WarnText>}
    </>
  );
};

const PathInput = (props: { configEntry: Entry }) => {
  const [path, setPath] = useState("");

  const { configEntry, ...rest } = props;
  if ("value" in rest) {
    delete rest.value;
  }

  async function set(path: string) {
    setPath(path);
    props.configEntry.set(path);
  }

  return <ConfigInput value={path} setValue={set} {...props} />;
};

const BaiduStatus = () => {
  const [user, setUser] = useState<string | undefined>(undefined);
  const [showBaiduLogin, setShowBaiduLogin] = useState(false);

  async function refresh() {
    const user = await singletons.baiduPCS.who();
    setUser(user);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function logout() {
    await singletons.baiduPCS.logout();
    setUser("");
  }

  function login() {
    setShowBaiduLogin(true);
    refresh();
  }

  const Inner = () => {
    switch (user) {
      case undefined:
        return (
          <>
            <Text> ... </Text>;
          </>
        );
      case "":
        return (
          <>
            <Button onClick={login} className="text-blue-500">
              {" "}
              登录{" "}
            </Button>
            <Text className="italic"> 未登录 </Text>
          </>
        );
      default:
        return (
          <>
            <Button onClick={logout} className="text-red-500">
              {" "}
              注销{" "}
            </Button>
            <Text className="italic"> [已登录] {user} </Text>
          </>
        );
    }
  };

  return (
    <>
      <Modal show={showBaiduLogin}>
        <div className="p-[20%]">
          <BaiduLogin
            onCancel={() => {
              setShowBaiduLogin(false);
            }}
            onFinish={() => {
              setShowBaiduLogin(false);
            }}
          />
        </div>
      </Modal>
      <Inner />
    </>
  );
};

export const ConfigPage = () => {
  return (
    <>
      <Container>
        <ConfigPanel>
          <Row>
            <Text> 下载到文件夹 </Text>
            <LocalDirConfig configEntry={configs.downloadPath} />
          </Row>
          <Divider />
          <Row>
            <Text> 安装到文件夹 </Text>
            <LocalDirConfig configEntry={configs.installPath} />
          </Row>
        </ConfigPanel>
        <ConfigPanel>
          <Row>
            <BaiduStatus />
          </Row>
          <Row>
            <Text> 百度网盘存储文件夹 </Text>
            <PathInput configEntry={configs.baiduPanPath} />
          </Row>
          <Divider />
          <Row>
            <Text className="text-blue-700">说明</Text>
          </Row>
        </ConfigPanel>
      </Container>
    </>
  );
};
