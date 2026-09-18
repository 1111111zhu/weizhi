// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import type { Project } from "@/api/client";

import { CmpSharedInformation } from "./cmp-shared-information";

const copy = {
  associationSummary: "Linked records",
  empProject: "EMP project",
  cmpClient: "CMP client",
  cmpEngagement: "CMP engagement",
  syncHealthy: "CMP sync is healthy",
  syncNeedsAttention: "CMP data needs attention",
  lastUpdated: "Last updated",
  businessSummary: "Business summary",
  auditYear: "Audit year",
  responsibles: "Responsibles",
  clientDetails: "Client details",
  showDetails: "Show all",
  hideDetails: "Collapse",
  companyCode: "Company code",
  companyRegistration: "Company registration",
  addresses: "Addresses",
  contacts: "Contacts",
  contactName: "Name",
  contactPosition: "Position",
  contactDepartment: "Department",
  contactOfficePhone: "Office phone",
  contactMobile: "Mobile",
  contactEmail: "Email",
  website: "Website",
  yearEndDate: "Year end",
  reportingGaap: "Reporting standard",
  industry: "Industry",
  incorporation: "Incorporation",
  listing: "Listing",
  group: "Group",
  parentCompany: "Parent company",
  subsidiaries: "Subsidiaries and associates",
  clientPic: "Client PIC",
  clientMic: "Client MIC",
  engagementCode: "Business code",
  serviceType: "Service type",
  status: "Status",
  engagementDate: "Engagement date",
  reportDate: "Report date",
  pic: "PIC",
  mic: "MIC",
  eqReviewer: "EQ Reviewer",
  deliverables: "Deliverables",
  auditorsReport: "Auditor's report",
  otherServiceDescription: "Other service description",
  noContacts: "No contacts",
  notProvided: "Not provided",
  active: "Active",
  inactive: "Inactive",
  codeLabels: {
    ACTIVE: "Active",
    AUDIT: "Audit",
    COMPANY_REGISTRATION_NUMBER: "Company registration number",
    LISTED: "Listed",
    REGISTERED: "Registered",
    PRINCIPAL: "Principal",
  },
} as const;

const project = {
  id: "project-1",
  workspaceId: "workspace-1",
  name: "Orchid audit",
  projectCode: "ORCHID-2026-AUD",
  reportingDate: "2027-03-31",
  status: "ACTIVE",
  cmpClientId: "client-1",
  cmpEngagementId: "engagement-1",
  cmpClient: {
    id: "client-1",
    clientCode: "C-ORCHID",
    companyCode: "ORC-HK",
    companyIdentifierType: "COMPANY_REGISTRATION_NUMBER",
    companyNumber: "7654321",
    nameZh: "兰花控股有限公司",
    nameEn: "Orchid Holdings Limited",
    status: "ACTIVE",
    address: "18 Harbour Road, Hong Kong",
    addresses: [
      {
        id: "address-1",
        type: "REGISTERED",
        label: "Registered office",
        address: "18 Harbour Road, Hong Kong",
        sortOrder: 0,
      },
      {
        id: "address-2",
        type: "PRINCIPAL",
        label: "Principal office",
        address: "8 Finance Street, Hong Kong",
        sortOrder: 1,
      },
    ],
    contacts: [
      {
        id: "contact-1",
        name: "Alice Wong",
        position: "Finance Director",
        department: "Finance",
        officePhone: "+852 2123 4567",
        mobile: "+852 9123 4567",
        email: "alice@orchid.example",
        remarks: null,
        sortOrder: 0,
      },
    ],
    website: "https://orchid.example",
    yearEndDate: "2026-12-31",
    reportingGaap: "HKFRS",
    hsicSectionCode: "K",
    industryOtherDescription: "Technology investment holding",
    placeOfIncorporation: "Hong Kong",
    incorporationYearMonth: "2018-05",
    listedOrPrivate: "LISTED",
    stockExchangeOrListingPlace: "HKEX",
    stockCode: "1234",
    groupName: "Orchid Group",
    parentClientCode: "C-ORCHID-PARENT",
    parentHoldingCompanyName: "Orchid Global Holdings",
    subsidiariesOrAssociates: "Orchid Technology; Orchid Retail",
    clientPartnerPic: "Jony Ma",
    clientManagerMic: "Leo Li",
    updatedAt: "2026-09-02T09:30:00.000Z",
  },
  cmpEngagement: {
    id: "engagement-1",
    clientId: "client-1",
    engagementCode: "ORCHID-2026-AUD",
    serviceType: "AUDIT",
    status: "ACTIVE",
    engagementDate: "2026-11-15",
    yearEndDate: "2026-12-31",
    reportDate: "2027-03-31",
    deliverables: [
      {
        key: "auditors-report",
        category: "ANNUAL_AUDIT",
        code: "AUDITORS_REPORT",
        sortOrder: 0,
      },
      {
        key: "management-letter",
        category: "OTHERS",
        code: "CUSTOM",
        description: "Management letter",
        sortOrder: 1,
      },
    ],
    pic: "Jony Ma",
    mic: "Leo Li",
    eqReviewer: "Eden Chan",
    otherServiceDescription: null,
    updatedAt: "2026-09-02T10:00:00.000Z",
  },
} as unknown as Project;

describe(CmpSharedInformation, () => {
  afterEach(cleanup);

  it("renders live client and engagement core information without commercial data", () => {
    render(
      <CmpSharedInformation copy={copy} locale="en-US" project={project} />
    );

    const association = screen.getByRole("region", {
      name: "Linked records",
    });
    expect(association).toHaveTextContent("Orchid audit");
    expect(association).toHaveTextContent("C-ORCHID");
    expect(association).toHaveTextContent("兰花控股有限公司");
    expect(association).toHaveTextContent("ORCHID-2026-AUD");
    expect(association).toHaveTextContent("CMP sync is healthy");
    expect(screen.getByTestId("cmp-last-updated-icon")).toBeVisible();
    expect(association).not.toHaveTextContent("· Last updated");

    const business = screen.getByRole("region", { name: "Business summary" });
    expect(business).toHaveTextContent("2026");
    expect(business).toHaveTextContent("Audit");
    expect(business).toHaveTextContent("HKFRS");

    const responsibles = screen.getByRole("region", { name: "Responsibles" });
    expect(responsibles).toHaveTextContent("Jony Ma");
    expect(responsibles).toHaveTextContent("Leo Li");
    expect(responsibles).toHaveTextContent("Eden Chan");

    expect(screen.queryByText("Alice Wong")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /show all/i }));
    const client = screen.getByRole("region", { name: "Client details" });
    expect(client).toHaveTextContent("7654321");
    expect(client).toHaveTextContent("Orchid Group");
    expect(client).toHaveTextContent("Orchid Global Holdings");
    expect(client).toHaveTextContent("Registered office");
    expect(client).toHaveTextContent("Principal office");
    const contacts = within(client).getByRole("table", { name: "Contacts" });
    expect(
      within(contacts).getByRole("columnheader", { name: "Name" })
    ).toBeVisible();
    expect(
      within(contacts).getByRole("columnheader", { name: "Office phone" })
    ).toBeVisible();
    expect(contacts).toHaveTextContent("Alice Wong");
    expect(contacts).toHaveTextContent("Finance Director");
    expect(contacts).toHaveTextContent("alice@orchid.example");

    const deliverables = screen.getByRole("region", { name: "Deliverables" });
    expect(deliverables).toHaveTextContent("Auditor's report");
    expect(deliverables).toHaveTextContent("Management letter");

    expect(screen.queryByText(/agreed fee/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/budgeted hours/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/aml/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Last updated/)).toBeVisible();
  });

  it("marks inactive source data and keeps missing values explicit", () => {
    const inactiveProject = {
      ...project,
      cmpClient: {
        ...project.cmpClient,
        status: "INACTIVE",
        contacts: [],
      },
      cmpEngagement: {
        ...project.cmpEngagement,
        status: "ARCHIVED",
        eqReviewer: null,
      },
    } as Project;

    render(
      <CmpSharedInformation
        copy={copy}
        locale="en-US"
        project={inactiveProject}
      />
    );

    expect(screen.getByText("CMP data needs attention")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /show all/i }));
    expect(screen.getByText("No contacts")).toBeVisible();
    const responsibles = screen.getByRole("region", { name: "Responsibles" });
    expect(
      within(responsibles).getByText("EQ Reviewer").parentElement
    ).toHaveTextContent("Not provided");
  });
});
