import type {
  CmpAcceptanceRequest,
  CmpAcceptanceRequestsResponse,
} from "@project-wing/shared";

export function getActiveAcceptanceApproverId(request: CmpAcceptanceRequest) {
  switch (request.status) {
    case "PENDING_MIC": {
      return request.micApproverId;
    }
    case "PENDING_PIC": {
      return request.picApproverId;
    }
    case "PENDING_IT": {
      return request.itApproverId;
    }
    default: {
      return null;
    }
  }
}

export function upsertAcceptanceRequest(
  response: CmpAcceptanceRequestsResponse | undefined,
  updatedRequest: CmpAcceptanceRequest
) {
  if (!response) {
    return response;
  }

  const exists = response.requests.some(
    (request) => request.id === updatedRequest.id
  );
  return {
    ...response,
    requests: exists
      ? response.requests.map((request) =>
          request.id === updatedRequest.id ? updatedRequest : request
        )
      : [updatedRequest, ...response.requests],
  };
}

export function reconcileApprovalQueue(
  response: CmpAcceptanceRequestsResponse | undefined,
  updatedRequest: CmpAcceptanceRequest,
  currentUserId: string | undefined
) {
  if (!response) {
    return response;
  }

  if (getActiveAcceptanceApproverId(updatedRequest) !== currentUserId) {
    return {
      ...response,
      requests: response.requests.filter(
        (request) => request.id !== updatedRequest.id
      ),
    };
  }

  return upsertAcceptanceRequest(response, updatedRequest);
}
