import type { GroupOrder } from "@/types";
export default function GroupMembershipNotice({
  message,
  status,
}: {
  message: string;
  status?: GroupOrder["status"];
}) {
  return (
    <div role="alert" className="group-order-error">
      <p className="font-semibold">You're already in a group order</p>
      <p>{message}</p>
      {status === "forming" ? (
        <p>
          To join a different group, leave your current group first, if leaving is still allowed.
        </p>
      ) : (
        <p>
          {status
            ? "Your current group cannot be left at this stage."
            : "Open your current group to review its available actions."}
        </p>
      )}
    </div>
  );
}
