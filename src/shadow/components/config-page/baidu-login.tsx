import { useState } from "react";
import {
  Button,
  Container,
  Divider,
  Input,
  Panel,
  Row,
  Text,
  WarnButton,
  WarnText,
} from "../general";
import {
  Login,
  StepKind as StepKind,
  Steps,
  Step,
} from "shadow/core/baidu-pcs";
import { singletons } from "shadow/singletons";

const UserPass = ({
  submit,
}: {
  submit: (username: string, password: string) => void;
}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <>
      <Row>
        <Text>账号</Text>
        <Input onChange={(e) => setUsername(e.target.value)} />
      </Row>
      <Row>
        <Text>密码</Text>
        <Input onChange={(e) => setPassword(e.target.value)} />
      </Row>
      <Row>
        <Button onClick={() => submit(username, password)}>登录</Button>
      </Row>
    </>
  );
};

const Captcha = ({
  submit,
  remoteUrl,
  localUrl,
}: {
  submit: (captcha: string) => void;
  remoteUrl: string;
  localUrl: string;
}) => {
  const [captcha, setCaptcha] = useState("");

  return (
    <>
      <Row>
        <img src={remoteUrl ? remoteUrl : localUrl} />
      </Row>
      <Row>
        <Text>请输入验证码</Text>
        <Input onChange={(e) => setCaptcha(e.target.value)} />
      </Row>
      <Row>
        <Button onClick={() => submit(captcha)}>确定</Button>
      </Row>
    </>
  );
};

const VerifyType = ({
  submit,
  phone,
  email,
}: {
  submit: (type: "mobile" | "email", dst: string) => void;
  phone: string;
  email: string;
}) => {
  return (
    <>
      <Row>
        <Text>请选择验证方式</Text>
      </Row>

      <Row>
        <Button onClick={() => submit("mobile", phone)}>手机: {phone}</Button>
      </Row>

      <Row>
        <Button onClick={() => submit("email", email)}>邮箱: {email}</Button>
      </Row>
    </>
  );
};

const VerifyCode = ({
  submit,
  verifyDst,
}: {
  submit: (code: string) => void;
  verifyDst: string;
}) => {
  const [code, setCode] = useState("");

  return (
    <>
      <Row>
        <Text>验证码已发送到：{verifyDst}</Text>
      </Row>
      <Row>
        <Text>请输入验证码</Text>
        <Input onChange={(e) => setCode(e.target.value)} />
      </Row>
      <Row>
        <Button onClick={() => submit(code)}>确定</Button>
      </Row>
    </>
  );
};

export const BaiduLogin = ({
  onFinish,
  onCancel,
}: {
  onFinish?: () => void;
  onCancel?: () => void;
}) => {
  const [step, setStep] = useState(new Steps.UserPassStep() as Step);
  const [login, setLogin] = useState(singletons.baiduPCS.login());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [verifyDst, setVerifyDst] = useState("");

  async function guard(f: () => Promise<void>) {
    setLoading(true);
    try {
      await f();
    } catch (e: any) {
      setError(e.message);
      reset();
    }
    setLoading(false);
  }

  async function reset() {
    try {
      await login.kill();
    } catch (e: any) {
      console.log(e.message);
    }
    setLogin(singletons.baiduPCS.login());
    setStep(new Steps.UserPassStep());
  }

  async function nextStep() {
    const step: Step = await login.nextStep();
    setStep(step);

    switch (step.kind) {
      case StepKind.Success:
        onFinish && onFinish();
        break;
      case StepKind.Failed:
        setError("登录失败");
        reset();
        break;
    }
  }

  async function handleUserPass(username: string, password: string) {
    await guard(async () => {
      await login.sendUserPass(username, password);
      await nextStep();
    });
  }

  async function handleCaptcha(captcha: string) {
    await guard(async () => {
      await login.sendCaptcha(captcha);
      await nextStep();
    });
  }

  async function handleVerifyType(type: "mobile" | "email", dst: string) {
    await guard(async () => {
      setVerifyDst(dst);
      await login.sendVerifyType(type);
      await nextStep();
    });
  }

  async function handleVerifyCode(verifyCode: string) {
    await guard(async () => {
      await login.sendVerifyCode(verifyCode);
      await nextStep();
    });
  }

  async function handleCancel() {
    await reset();
    onCancel && onCancel();
  }

  const Inner = () => {
    switch (step.kind) {
      case StepKind.UserPass:
        return <UserPass submit={handleUserPass} />;
      case StepKind.Captcha:
        return (
          <Captcha
            submit={handleCaptcha}
            remoteUrl={step.remoteUrl}
            localUrl={step.localUrl}
          />
        );
      case StepKind.VerifyType:
        return (
          <VerifyType
            submit={handleVerifyType}
            phone={step.phone}
            email={step.email}
          />
        );
      case StepKind.VerifyCode:
        return <VerifyCode submit={handleVerifyCode} verifyDst={verifyDst} />;
      case StepKind.Success:
        return <Text>登录成功</Text>;
      default:
        return <Text>未知错误</Text>;
    }
  };

  return (
    <Panel className="items-center">
      <Row>
        <Text>登录百度网盘</Text>
      </Row>
      <Divider />
      {error && (
        <Row>
          <WarnText>{error}</WarnText>
        </Row>
      )}
      <Inner />
      <Row>
        <WarnButton onClick={handleCancel}>取消</WarnButton>
      </Row>
      {loading && (
        <Row>
          <Text className="text-gray-600">登录中...</Text>
        </Row>
      )}
    </Panel>
  );
};
