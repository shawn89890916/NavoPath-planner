import { useState, type ReactNode } from "react";
import { UiChevronDownIcon, UiChevronRightIcon } from "../components/UiIcons";
import type { Language, Task, TimeEntry } from "../types";
import { Button, Input } from "../components/UiPrimitives";
import { TaskGroup } from "../components/TaskBlock";
import { createBook, groupReadingBooks, readingTotals, updateBook, type ReadingBook, type ReadingLibrary, type ReadingProgress, type ReadingStatus } from "./model";
import "./ReadingShelf.css";

export type ReadingMutate = (change: (library: ReadingLibrary) => ReadingLibrary) => Promise<ReadingLibrary>;
type Props = {
  library: ReadingLibrary | null; busy: boolean; error: string; lang: Language;
  onCreateTask: (bookId: string) => Promise<void>;
};
function ReadingTaskComposer({ library, busy, error, lang, onCreateTask }: Props) {
  const zh = lang === "zh";
  const [selected, setSelected] = useState("");
  const [failed, setFailed] = useState(false);
  const books = library?.books.filter(book => book.status !== "finished") ?? [];
  const selectedId = books.some(book => book.id === selected) ? selected : books[0]?.id ?? "";
  if (!library) return <p className="reading-muted" role="status">{error ? (zh ? "书架暂不可用，请重新打开窗口。" : "Library unavailable. Reopen the window.") : (zh ? "正在读取书架…" : "Loading library…")}</p>;
  if (!books.length) return <p className="reading-muted">{zh ? "在书架添加一本待阅读的书。" : "Add a book to your shelf first."}</p>;
  return <form className="reading-composer" onSubmit={event => {
    event.preventDefault(); setFailed(false);
    if (selectedId && !busy) void onCreateTask(selectedId).catch(() => setFailed(true));
  }}>
    <select className="ui-input" aria-label={zh ? "选择书籍" : "Choose a book"} value={selectedId} onChange={event => setSelected(event.target.value)} disabled={busy}>
      {books.map(book => <option key={book.id} value={book.id}>{book.title}</option>)}
    </select>
    <Button type="submit" variant="secondary" disabled={busy || !selectedId}>{zh ? "添加阅读任务" : "Add reading task"}</Button>
    {failed && <p role="alert" className="reading-muted">{zh ? "未能创建任务，请重试。" : "Task could not be created. Try again."}</p>}
  </form>;
}

export function ReadingTaskGroup(props: Props & { count: number; onOpenLibrary?: () => void; children: ReactNode }) {
  const [expanded, setExpanded] = useState(true);
  const zh = props.lang === "zh";
  return <TaskGroup title={<Button variant="ghost" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
    {expanded ? <UiChevronDownIcon size={16} /> : <UiChevronRightIcon size={16} />}{zh ? "阅读" : "Reading"}
  </Button>} count={<Button variant="ghost" disabled={!props.onOpenLibrary} onClick={props.onOpenLibrary}>{zh ? "书架" : "Library"} · {props.count}</Button>}>
    {expanded && <>{props.children}<ReadingTaskComposer {...props} /></>}
  </TaskGroup>;
}

const statusNames = {
  "to-read": ["准备读", "To read"], reading: ["正在读", "Reading"], finished: ["已读完", "Finished"],
} as const;
const statuses = Object.keys(statusNames) as ReadingStatus[];
const progressText = (p: ReadingProgress, zh: boolean) => p.unit === "percent" ? p.current + "%" : p.current + (p.total === undefined ? "" : "/" + p.total) + (p.unit === "pages" ? (zh ? " 页" : " pages") : (zh ? " 章" : " chapters"));

function BookEditor({ book, zh, busy, onSave, onCancel }: {
  book?: ReadingBook; zh: boolean; busy: boolean;
  onSave: (patch: { title: string; author: string; status: ReadingStatus; progress: ReadingProgress }) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(book?.title ?? "");
  const [author, setAuthor] = useState(book?.author ?? "");
  const [status, setStatus] = useState<ReadingStatus>(book?.status ?? "to-read");
  const [unit, setUnit] = useState<ReadingProgress["unit"]>(book?.progress.unit ?? "percent");
  const [current, setCurrent] = useState(String(book?.progress.current ?? 0));
  const [total, setTotal] = useState(book && book.progress.unit !== "percent" ? String(book.progress.total ?? "") : "");
  const [error, setError] = useState(false);
  return <form className="reading-editor" onSubmit={event => {
    event.preventDefault(); setError(false);
    const progress: ReadingProgress = unit === "percent" ? { unit, current: Number(current) } : { unit, current: Number(current), ...(total.trim() ? { total: Number(total) } : {}) };
    void onSave({ title, author, status, progress }).catch(() => setError(true));
  }}>
    <label>{zh ? "书名" : "Title"}<Input required value={title} onChange={event => setTitle(event.target.value)} maxLength={240} disabled={busy} /></label>
    <label>{zh ? "作者" : "Author"}<Input value={author} onChange={event => setAuthor(event.target.value)} maxLength={240} disabled={busy} /></label>
    <label>{zh ? "状态" : "Status"}<select className="ui-input" value={status} onChange={event => setStatus(event.target.value as ReadingStatus)} disabled={busy}>{statuses.map(value => <option key={value} value={value}>{statusNames[value][zh ? 0 : 1]}</option>)}</select></label>
    <label>{zh ? "进度单位" : "Progress unit"}<select className="ui-input" value={unit} onChange={event => { setUnit(event.target.value as ReadingProgress["unit"]); setCurrent("0"); setTotal(""); }} disabled={busy}><option value="percent">{zh ? "百分比" : "Percent"}</option><option value="pages">{zh ? "页数" : "Pages"}</option><option value="chapters">{zh ? "章节" : "Chapters"}</option></select></label>
    <label>{zh ? "已读" : "Read"}<Input required type="number" min={0} max={unit === "percent" ? 100 : undefined} step={unit === "percent" ? "any" : 1} value={current} onChange={event => setCurrent(event.target.value)} disabled={busy} /></label>
    {unit !== "percent" && <label>{zh ? "总数（可选）" : "Total (optional)"}<Input type="number" min={1} step={1} value={total} onChange={event => setTotal(event.target.value)} disabled={busy} /></label>}
    {error && <p className="reading-muted" role="alert">{zh ? "无法保存，请检查书名、进度及连接状态。" : "Unable to save. Check the title, progress and connection."}</p>}
    <div className="reading-actions"><Button variant="ghost" onClick={onCancel} disabled={busy}>{zh ? "取消" : "Cancel"}</Button><Button variant="primary" type="submit" disabled={busy || !title.trim()}>{zh ? "保存" : "Save"}</Button></div>
  </form>;
}
export default function ReadingShelf({ library, busy, error, lang, onCreateTask, mutate, tasks, entries, engagementEnabled, onSaved }: Props & {
  mutate: ReadingMutate; tasks: readonly Task[]; entries: readonly TimeEntry[]; engagementEnabled: boolean;
  onSaved: (before: ReadingBook | undefined, after: ReadingBook) => void;
}) {
  const zh = lang === "zh";
  const [editor, setEditor] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  if (!library) return <p className="reading-muted" role="status">{error ? (zh ? "无法读取书架，请重新打开窗口。" : "Library unavailable. Reopen the window.") : (zh ? "正在读取书架…" : "Loading library…")}</p>;
  const groups = groupReadingBooks(library);
  const book = library.books.find(item => item.id === editor);
  const run = (action: () => Promise<void>) => { setFailed(false); void action().catch(() => setFailed(true)); };
  return <section className="reading-shelf" aria-label={zh ? "阅读书架" : "Reading shelf"}>
    <header className="reading-heading"><div><h2>{zh ? "书架" : "Library"}</h2><p className="reading-muted">{zh ? "管理书籍与阅读进度" : "Books and reading progress"}</p></div><Button variant="primary" disabled={busy} onClick={() => setEditor("new")}>{zh ? "添加书籍" : "Add book"}</Button></header>
    {editor && (editor === "new" || book) && <BookEditor key={editor} book={book} zh={zh} busy={busy} onCancel={() => setEditor(null)} onSave={async patch => {
      const now = new Date().toISOString();
      const id = book?.id ?? crypto.randomUUID();
      let before: ReadingBook | undefined;
      const saved = await mutate(current => {
        before = current.books.find(item => item.id === id);
        if (book && (!before || JSON.stringify(before) !== JSON.stringify(book))) throw new Error("Book changed on another device");
        return updateBook(book ? current : createBook(current, { id, title: patch.title, author: patch.author, now }), id, patch, now);
      });
      setEditor(null); onSaved(before, saved.books.find(item => item.id === id)!);
    }} />}
    {failed && <p role="alert" className="reading-muted">{zh ? "操作失败，请重试。" : "Action failed. Try again."}</p>}
    {statuses.map(status => <TaskGroup key={status} title={statusNames[status][zh ? 0 : 1]} count={groups[status].length}>
      {groups[status].length === 0 && <p className="reading-muted">{zh ? "暂无书籍" : "No books"}</p>}
      {groups[status].map(item => {
        const totals = readingTotals(library, item.id, tasks, entries, engagementEnabled);
        const progress = item.progress.unit === "percent" ? item.progress.current : item.progress.total ? item.progress.current / item.progress.total * 100 : null;
        return <article className="reading-book" key={item.id}>
          <header className="reading-book-header"><button className="reading-book-title" type="button" onClick={() => setEditor(item.id)}>{item.title}</button><span className="reading-muted">{progressText(item.progress, zh)}</span></header>
          {item.author && <p className="reading-muted">{item.author}</p>}
          {progress !== null && <progress aria-label={zh ? "阅读进度" : "Reading progress"} max={100} value={progress} />}
          <p className="reading-muted">{zh ? "计划" : "Planned"} {Math.round(totals.plannedMinutes)}m · {zh ? "实际" : "Actual"} {Math.round(totals.actualMinutes)}m{totals.weightedMinutes !== null ? " · " + (zh ? "加权" : "Weighted") + " " + Math.round(totals.weightedMinutes) + "m" : ""}</p>
          <div className="reading-actions"><Button variant="ghost" disabled={busy} onClick={() => setEditor(item.id)}>{zh ? "编辑进度" : "Edit progress"}</Button>{status !== "finished" && <Button variant="secondary" disabled={busy} onClick={() => run(() => onCreateTask(item.id))}>{zh ? "添加阅读任务" : "Add reading task"}</Button>}</div>
        </article>;
      })}
    </TaskGroup>)}
  </section>;
}
