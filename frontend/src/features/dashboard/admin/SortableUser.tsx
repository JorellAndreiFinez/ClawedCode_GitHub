import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export function SortableUser({ id, user }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="border p-3 rounded bg-white flex justify-between cursor-grab active:cursor-grabbing"
    >
      <div>
        <p className="font-medium">{user.name}</p>
        <p className="text-xs text-gray-500">Ticket #{user.ticket_number}</p>
      </div>

      <span className="text-xs px-2 py-1 rounded bg-gray-100">
        {user.status}
      </span>
    </div>
  );
}
