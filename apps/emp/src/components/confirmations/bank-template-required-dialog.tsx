import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";

export function BankTemplateRequiredDialog({
  open,
  onOpenChange,
  locale,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
}) {
  const chinese = locale.startsWith("zh");
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{chinese ? "无法应用银行信息" : "Cannot apply bank information"}</AlertDialogTitle>
          <AlertDialogDescription>
            {chinese
              ? "该银行要求使用银行指定格式，无法将银行信息应用到当前模板。请使用该银行提供的函证格式。"
              : "This bank requires its own confirmation format. Bank information cannot be applied to the current template. Please use the confirmation form provided by the bank."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => onOpenChange(false)}>{chinese ? "知道了" : "OK"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
