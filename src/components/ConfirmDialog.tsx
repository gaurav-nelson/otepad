import { AlertDialog } from "@astryxdesign/core/AlertDialog";

type ConfirmState = {
  title: string;
  description: string;
  actionLabel: string;
} | null;

type ConfirmDialogProps = {
  confirm: ConfirmState;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  confirm,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog
      isOpen={confirm !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel();
      }}
      title={confirm?.title ?? ""}
      description={confirm?.description ?? ""}
      actionLabel={confirm?.actionLabel ?? "Delete"}
      cancelLabel="Cancel"
      onAction={onConfirm}
    />
  );
}

export type { ConfirmState };
