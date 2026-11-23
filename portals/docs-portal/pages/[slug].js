import React from "react";
import Head from "next/head";
import DocsShell from "../components/DocsShell";
import ChapterArticle from "../components/ChapterArticle";
import { MANUAL_CHAPTERS, MANUAL_META, getChapterById } from "../data/manualChapters";

export async function getStaticPaths() {
  return {
    paths: MANUAL_CHAPTERS.map((c) => ({ params: { slug: c.id } })),
    fallback: false
  };
}

export async function getStaticProps({ params }) {
  const chapter = getChapterById(params.slug);
  return {
    props: {
      chapter
    }
  };
}

export default function ManualChapterPage({ chapter }) {
  if (!chapter) return null;
  return (
    <DocsShell activeChapter={chapter}>
      <Head>
        <title>
          {chapter.number}. {chapter.title} — Nornia Doküman ({MANUAL_META.version})
        </title>
        <meta name="description" content={chapter.summary} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="alternate icon" href="/favicon.ico" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </Head>
      <ChapterArticle chapter={chapter} />
    </DocsShell>
  );
}
