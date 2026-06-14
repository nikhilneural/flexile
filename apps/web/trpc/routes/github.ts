export type IssueOrPullRequest = {
  id: number;
  title: string;
  url: string;
  status: "open" | "closed" | "merged";
  type: "issue" | "pull_request";
  number: number;
  repositoryName: string;
  createdAt: string;
  closedAt: string | null;
};
