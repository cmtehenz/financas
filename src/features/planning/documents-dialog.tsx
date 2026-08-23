"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  deleteHouseholdDocumentAction,
  listHouseholdDocumentsAction,
  uploadHouseholdDocumentsAction,
} from "@/actions/documents";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { fieldControlClassName } from "@/features/app/ui";
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_KINDS,
  formatDocumentBytes,
  type DocumentKind,
  type DocumentSubject,
} from "@/domain/documents";

type DocumentRow = {
  id: string;
  kind: string;
  fileName: string;
  contentType: string;
  byteSize: number;
};

export function PlannerDocumentsDialog({
  title,
  subject,
  onClose,
  onChanged,
}: {
  title: string;
  subject: DocumentSubject;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [kind, setKind] = useState<DocumentKind>("BOLETO");
  const [pending, setPending] = useState(false);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);

  async function refresh() {
    const result = await listHouseholdDocumentsAction(subject);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setDocuments(result.data ?? []);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const result = await listHouseholdDocumentsAction(subject);
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDocuments(result.data ?? []);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [subject]);

  async function onUpload(formData: FormData) {
    setPending(true);
    try {
      formData.set("subjectType", subject.subjectType);
      formData.set("subjectId", subject.subjectId);
      formData.set("kind", kind);
      const result = await uploadHouseholdDocumentsAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(result.data && result.data.length > 1 ? "Arquivos adicionados." : "Arquivo adicionado.");
      await refresh();
      onChanged();
    } finally {
      setPending(false);
    }
  }

  async function onDelete(documentId: string) {
    setPending(true);
    try {
      const result = await deleteHouseholdDocumentAction({ documentId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Arquivo removido.");
      await refresh();
      onChanged();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title="Arquivos">
      <div className="space-y-4">
        <p className="text-secondary">{title}</p>

        {documents.length === 0 ? (
          <p className="text-secondary" data-testid="planner-documents-empty">
            Nenhum arquivo nesta linha. Adicione boleto, comprovante ou nota fiscal.
          </p>
        ) : (
          <ul className="space-y-2" data-testid="planner-documents-list">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{document.fileName}</p>
                  <p className="text-caption">
                    {DOCUMENT_KIND_LABELS[document.kind as DocumentKind] ?? document.kind}
                    {" · "}
                    {formatDocumentBytes(document.byteSize)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <a
                    href={`/api/documents/${document.id}`}
                    className="inline-flex min-h-9 items-center rounded-lg px-2 text-sm text-foreground hover:bg-muted"
                  >
                    Abrir
                  </a>
                  <button
                    type="button"
                    className="inline-flex min-h-9 cursor-pointer items-center rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    disabled={pending}
                    onClick={() => void onDelete(document.id)}
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form action={onUpload} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="planner-document-kind">Tipo</Label>
            <select
              id="planner-document-kind"
              className={fieldControlClassName}
              value={kind}
              onChange={(event) => setKind(event.target.value as DocumentKind)}
            >
              {DOCUMENT_KINDS.map((value) => (
                <option key={value} value={value}>
                  {DOCUMENT_KIND_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="planner-document-input">Arquivos</Label>
            <input
              id="planner-document-input"
              name="files"
              type="file"
              multiple
              accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.pdf,.jpg,.jpeg,.png,.webp,.heic"
              data-testid="planner-document-input"
              className="field-control cursor-pointer py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
            />
            <p className="text-caption">PDF ou imagem, até 4 MB cada. Dá para enviar vários de uma vez.</p>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Adicionar arquivos"}
          </Button>
        </form>
      </div>
    </Dialog>
  );
}
