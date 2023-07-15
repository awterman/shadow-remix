import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDownload,
  faStop,
  faRotateBack,
  faXmark,
  faPlay,
  faPause,
} from "@fortawesome/free-solid-svg-icons";
import { Container } from "../general";
import tw from "tailwind-styled-components";
import { TaskConfig, TaskState } from "shadow/core/download";
import { singletons } from "shadow/singletons";
import { shell } from "shadow/core/apis";
import { explorer } from "shadow/core/shell";

const List = tw.ul`
    list-none
    py-3
`;

const ItemContainer = tw.li`
    relative

    grid
    grid-cols-[auto_minmax(0,1fr)]
    items-center

    text-2xl

    border-yellow-700
    hover:bg-slate-500
    hover:text-gray-900

    py-3
    my-1

    px-4
    pb-4
`;

const Row = tw.div`
    grid
    grid-cols-[auto_minmax(0,1fr)]
    gap-2
    items-center
    
    py-2
`;

const Heading = ({ children }: { children: React.ReactNode }) => (
  <Row>
    <div className="items-center">
      <p className="text-2xl font-semibold text-gray-700">{children}</p>
    </div>
    {/* <hr className='border-gray-500 border-[1px] rounded-full' /> */}
  </Row>
);

const ItemText = tw.p`
    text-xl
    text-gray-600
    cursor-default
`;

const IconButton = ({
  hover,
  children,
  ...props
}: {
  hover?: boolean;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  return (
    <button
      className={`px-[0.2em] rounded-sm ${
        hover ? "text-neutral-600" : "text-neutral-500"
      } hover:text-slate-900`}
      {...props}
    >
      {children}
    </button>
  );
};

const RightContainer = tw.div`
    flex
    gap-1
    justify-self-end
`;

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

const Progress = ({ task }: { task: TaskConfig }) => {
  const [progress, setProgress] = useState(task.progress);

  useEffect(() => {
    return singletons.downloadManager.onTaskProgress((id, progress) => {
      if (id === task.id) {
        setProgress(progress);
      }
    });
  }, []);

  return (
    <p className="text-sm self-center text-gray-600">
      {`${formatBytes(progress.downloaded)} / ${formatBytes(progress.total)}`}
    </p>
  );
};

const DeleteButton = ({
  taskId,
  hover: parentHover,
}: {
  taskId: string;
  hover: boolean;
}) => {
  return (
    <IconButton
      className={`text-orange-900 hover:text-orange-800 ${
        parentHover ? "" : "invisible"
      }`}
      hover={parentHover}
      onClick={() => singletons.downloadManager.deleteTask(taskId)}
    >
      <FontAwesomeIcon icon={faXmark} />
    </IconButton>
  );
};

const Item = ({
  task,
  children,
}: {
  task: TaskConfig;
  children: React.ReactNode;
}) => {
  const [hover, setHover] = useState(false);

  const childrenWithProps = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child as React.ReactElement, { hover });
    }
    return child;
  });

  return (
    <ItemContainer
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => explorer(task.localPath)}
    >
      <ItemText>{task.name.split("|")[0]}</ItemText>
      <RightContainer>
        {childrenWithProps}
        <DeleteButton taskId={task.id} hover={hover} />
      </RightContainer>
    </ItemContainer>
  );
};

const DownloadingButton = ({ task }: { task: TaskConfig }) => {
  // if the task is paused, show a play button
  // if the task is downloading, show a pause button

  const [paused, setPaused] = useState(task.state === "paused");

  useEffect(() => {
    return singletons.downloadManager.onTaskStateChanged((id) => {
      (async () => {
        const state = (await singletons.downloadManager.getTask(id))?.state;

        if (id === task.id) {
          setPaused(state === "paused");
        }
      })();
    });
  }, []);

  return (
    <IconButton
      onClick={() => {
        if (paused) {
          singletons.downloadManager.resumeTask(task.id);
        } else {
          singletons.downloadManager.pauseTask(task.id);
        }
      }}
    >
      <FontAwesomeIcon icon={paused ? faPlay : faPause} />
    </IconButton>
  );
};

const DownloadPage = () => {
  const [downloading, setDownloading] = useState<TaskConfig[]>([]);
  const [waiting, setWaiting] = useState<TaskConfig[]>([]);
  const [completed, setCompleted] = useState<TaskConfig[]>([]);

  async function refresh() {
    const tasks = await singletons.downloadManager.getTasks();

    function getByStates(states: TaskState[]): TaskConfig[] {
      return tasks.filter((task) => states.includes(task.state));
    }

    setDownloading(getByStates(["downloading", "paused"]));
    setWaiting(getByStates(["waiting"]));
    setCompleted(getByStates(["completed"]));
  }

  useEffect(() => {
    refresh();

    return singletons.downloadManager.onTaskStateChanged(refresh);
  }, []);

  return (
    <Container>
      <div className="self-center w-[clamp(0px,80em,80%)]">
        <Heading>下载中</Heading>
        <List>
          {downloading.map((task) => (
            <Item key={task.id} task={task}>
              <Progress task={task} />
              <DownloadingButton task={task} />
            </Item>
          ))}
        </List>

        <Heading>等待中</Heading>
        <List>
          {waiting.map((task) => (
            <Item key={task.id} task={task}>
              <Progress task={task} />
              <IconButton
                onClick={() => singletons.downloadManager.startTask(task.id)}
              >
                <FontAwesomeIcon className="fa-x" icon={faDownload} />
              </IconButton>
              <IconButton
                onClick={() => singletons.downloadManager.restartTask(task.id)}
              >
                <FontAwesomeIcon className="fa-x" icon={faRotateBack} />
              </IconButton>
            </Item>
          ))}
        </List>

        <Heading>已完成</Heading>
        <List>
          {completed.map((task) => (
            <Item key={task.id} task={task}>
              <IconButton
                onClick={() => singletons.downloadManager.restartTask(task.id)}
              >
                <FontAwesomeIcon className="fa-x" icon={faRotateBack} />
              </IconButton>
            </Item>
          ))}
        </List>
      </div>
    </Container>
  );
};

export default DownloadPage;
