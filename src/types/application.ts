export interface RelatedApplication {
  id: string;
  status: ApplicationStatus;
  petId: string;
  petName: string;
  interview: { at: string; status: string; staff: string[] } | null;
}