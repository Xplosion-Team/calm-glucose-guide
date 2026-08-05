import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/i18n/I18nProvider";
import type { FoodLog } from "@/hooks/useFoodLogs";

interface Props {
  log: FoodLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string) => void | Promise<void>;
}

export function DeleteLogDialog({ log, open, onOpenChange, onConfirm }: Props) {
  const { lang } = useI18n();
  const es = lang === "es";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">
            {es ? "¿Eliminar esta entrada?" : "Delete this entry?"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            {log
              ? es
                ? `"${log.label}" se eliminará de tu diario. Esta acción no se puede deshacer.`
                : `"${log.label}" will be removed from your journal. This can't be undone.`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-12 text-base">
            {es ? "Cancelar" : "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-12 text-base bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={async () => {
              if (log) await onConfirm(log.id);
              onOpenChange(false);
            }}
          >
            {es ? "Eliminar" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
