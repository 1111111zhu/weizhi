export function getConfirmationAuxiliaryCopy(locale: string) {
  return locale === "zh-CN"
    ? {
        addHistoricalAddress: "新增地址",
        removeHistoricalAddress: "移除历史寄送地址",
        savedFields: "已保存的可填写字段",
      }
    : {
        addHistoricalAddress: "Add address",
        removeHistoricalAddress: "Remove historical mailing address",
        savedFields: "Saved fillable fields",
      };
}
