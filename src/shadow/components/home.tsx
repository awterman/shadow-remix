import { SearchPage } from "./search-page/search-page";
import { ConfigPage } from "./config-page/config-page";
import React, { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear } from "@fortawesome/free-solid-svg-icons";
import { Modal, Panel, Row, Text } from "./general";
import DownloadPage from "./download-page/download-page";

import { sendNotification } from "@tauri-apps/api/notification";
import { paths, singletons } from "shadow/singletons";
import { runCommand } from "shadow/core/process";
import { Updater } from "../core/update";
import { shadowDirs } from "../singletons/paths";
import { getVersion } from "@tauri-apps/api/app";

(async function () {
  const updater = new Updater(
    await getVersion(),
    "shadow.cloud/release-status",
    shadowDirs.root,
    "shadow.exe",
    shadowDirs.download,
    singletons.zipHandler,
    singletons.logger
  );

  await updater.cleanUpOldExecutable();
  await updater.updateAndRelaunchIfAvailable();

  // asynchronously check for updates
  updater.downloadReleaseIfAvailable();
})();

const Tab = ({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) => (
  <div
    className={`text-2xl cursor-pointer hover:text-sky-700 ${
      active ? "text-zinc-700" : "text-zinc-500"
    }`}
    onClick={onClick}
  >
    {children}
  </div>
);

const Separator = () => <p className="text-2xl font-thin px-1">/</p>;

function App() {
  const [showConfig, setShowConfig] = useState(false);
  const [activeTab, setActiveTab] = useState("search");

  // TODO: remove this
  useEffect(() => {
    // @ts-ignore
    window.notify = sendNotification;
    // @ts-ignore
    window.singletons = singletons;
    // @ts-ignore
    window.runCommand = runCommand;
  });

  function close(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    if (e.target === e.currentTarget) {
      setShowConfig(false);
    }
  }

  const InnerTab = ({
    name,
    children,
  }: {
    name: string;
    children: React.ReactNode;
  }) => (
    <Tab active={activeTab === name} onClick={() => setActiveTab(name)}>
      {children}
    </Tab>
  );

  const Page = () => {
    switch (activeTab) {
      case "library":
        return <Text>库</Text>;
      case "search":
        return <SearchPage />;
      case "download":
        return <DownloadPage />;
      default:
        return <DownloadPage />;
    }
  };

  return (
    <div className="py-4 bg-neutral-400 min-h-screen">
      <FontAwesomeIcon
        className="fixed top-4 right-4 hover:rotate-45 transition-all fa-lg py-4"
        icon={faGear}
        onClick={() => setShowConfig(!showConfig)}
      />

      <Row className="px-20">
        {/*<InnerTab name="library">库</InnerTab>*/}
        {/*<Separator />*/}
        <InnerTab name="search">搜索</InnerTab>
        <Separator />
        <InnerTab name="download">下载</InnerTab>
      </Row>
      <Page />
      <Modal show={showConfig} onClick={close}>
        <Panel className="w-[90%] h-[90%] m-auto absolute left-0 right-0 top-0 bottom-0 bg-gray-300">
          <ConfigPage />
        </Panel>
      </Modal>
    </div>
  );
}

export default App;
