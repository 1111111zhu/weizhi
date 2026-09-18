import type { ConfirmationGeneralLayout } from "../../api/client";
import type { Dictionary } from "../../i18n/dictionaries";

// Use the same field renderer on mobile when no configured layout is available.
export function getConfirmationBaseInformationFallback(
  copy: Dictionary["confirmations"],
  customFields: { id: string; name: string }[]
): ConfirmationGeneralLayout {
  const text = copy.baseInformation;
  return {
    sections: [
      {
        id: "clients",
        name: text.clientNames,
        fields: [
          { id: "client-name", name: text.clientNames, binding: "clientName" },
        ],
      },
      {
        id: "references",
        name: text.references,
        fields: [
          { id: "reference", name: text.references, binding: "referenceCode" },
        ],
      },
      {
        id: "banks",
        name: text.banks,
        fields: [
          { id: "bank-name", name: text.bankName, binding: "bankName" },
          { id: "bank-account", name: text.account, binding: "accountNumber" },
          {
            id: "bank-address",
            name: text.address,
            binding: "recipientAddress",
          },
        ],
      },
      {
        id: "general",
        name: copy.generalFill.title,
        fields: [
          {
            id: "confirmation-date",
            name: copy.generalFill.fields.date,
            binding: "officeDate",
          },
          { id: "pic", name: copy.generalFill.fields.pic, binding: "picName" },
          { id: "mic", name: copy.generalFill.fields.mic, binding: "micName" },
          {
            id: "report-date",
            name: copy.generalFill.fields.reportDate,
            binding: "reportDate",
          },
          ...customFields.map(({ id, name }) => ({ id, name })),
        ],
      },
    ],
  };
}
