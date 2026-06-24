"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { OutlineButton } from "@/components/ui";
import { deleteTemplateAction } from "../actions";

export function TemplateActions({ templateId }: { templateId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm("このテンプレートを削除しますか？")) return;
    startTransition(async () => {
      const result = await deleteTemplateAction(templateId);
      if (result.ok) {
        router.push("/templates");
        router.refresh();
      } else {
        setMessage(result.message ?? "削除に失敗しました。");
      }
    });
  }

  return (
    <>
      <OutlineButton onClick={remove} disabled={isPending}>
        <Trash2 size={14} className="mr-1 inline align-[-2px]" />
        {isPending ? "削除中..." : "削除"}
      </OutlineButton>
      {message && <p className="text-xs text-[#FF6B6B]">{message}</p>}
    </>
  );
}
