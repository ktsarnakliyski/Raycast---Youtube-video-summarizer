import { Action, ActionPanel, Detail, Icon, unstable_AI, useUnstableAI } from "@raycast/api";
import { useEffect, useState } from "react";
import { YoutubeTranscript } from "youtube-transcript";
import ytdl from "ytdl-core";

export async function getVideoSections(text: string) {
  const chunks = text.match(/.{1,6000}/g) || [];
  const jobs = chunks.map((chunk) => {
    return unstable_AI.ask(`${chunk}\n\n---\n\nSummarize the above segment of YouTube video transcriptions.`);
  });
  const sections = await Promise.all(jobs);
  return sections.join("\n\n");
}

async function summarizeVideo(url: string) {
  const captions = await YoutubeTranscript.fetchTranscript(url);
  const fullTranscript = captions
    .map((item) => item.text)
    .join(" ")
    .replaceAll("\n", " ");

  if (fullTranscript.length < 6000) {
    return fullTranscript;
  }

  return getVideoSections(fullTranscript);
}

async function getVideoInfo(url: string) {
  const information = await ytdl.getBasicInfo(url);
  const title = information.videoDetails.title;
  const author = information.videoDetails.author.name;
  return { title, author };
}

export default function Command(props: { arguments: { url: string } }) {
  const [sections, setSections] = useState("");
  const [metadata, setMetadata] = useState<null | { title: string; author: string }>(null);

  useEffect(() => {
    summarizeVideo(props.arguments.url).then(setSections);
    getVideoInfo(props.arguments.url).then(setMetadata);
  }, []);

  if (!sections || !metadata) {
    return <Detail markdown={`# ${metadata?.title ?? ""}`} isLoading />;
  }

  return <Summary sections={sections} title={metadata.title} author={metadata.author} />;
}

function Summary({ sections, title, author }: { sections: string; title: string; author: string }) {
  const {
    data: summary,
    isLoading,
    revalidate,
  } = useUnstableAI(
    `${sections}---\n\nSummarize the above YouTube video segments from a video titled "${title}" by ${author}.`
  );

  return (
    <Detail
      markdown={`# ${title}\n\n${summary}`}
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy Summary" content={summary} />
          <Action.Paste content={summary} />
          <Action
            title="Regenerate Summary"
            onAction={revalidate}
            icon={Icon.ArrowCounterClockwise}
            shortcut={{ key: "r", modifiers: ["cmd"] }}
          />
        </ActionPanel>
      }
    />
  );
}
