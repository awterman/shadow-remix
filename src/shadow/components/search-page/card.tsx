import { useState } from "react";
import { configs, singletons } from "shadow/singletons";
import { Entry } from "shadow/contracts";
import tw from "tailwind-styled-components";
import { Button, Text } from "../general";
import { ZipInstallConfig } from "shadow/core/download";
import { notifyDesktop } from "shadow/core/notify";

const Container = tw.div`
    text-center
    grid
    grid-rows-[2fr,1.2fr]
    bg-neutral-800
        
    items-center

    shadow-zinc-500
    shadow-xl
    hover:shadow-zinc-600
    transition-all
`;

const Overlay = tw.div`
    absolute

    w-full
    h-full
    bg-black
    bg-opacity-30
`;

export const Card = ({ entry }: { entry: Entry }): JSX.Element => {
  const [showOverlay, setShowOverlay] = useState(false);

  async function addTask() {
    const taskId = await entry.addDownloadTask(singletons, configs);
    await singletons.downloadManager.startTask(taskId);

    // TODO: show notification
    setShowOverlay(false);
  }

  return (
    <Container
      className="relative"
      onClick={() => setShowOverlay(true)}
      onMouseLeave={() => setShowOverlay(false)}
    >
      <img src={entry.imgUrl} />
      <Text className="text-white text-lg">{entry.name.split("|")[0]}</Text>
      {showOverlay && (
        <Overlay>
          <div className="flex h-full justify-center items-center">
            <Button
              className="h-16 w-32 text-lg font-sans rounded-lg text-slate-600 bg-gray-400 hover:bg-gray-300"
              onClick={addTask}
            >
              安装
            </Button>
          </div>
        </Overlay>
      )}
    </Container>
  );
};
