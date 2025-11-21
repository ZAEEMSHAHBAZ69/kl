export default function TableRowSkeleton({ columns = 8 }: { columns?: number }) {
    return (
        <tr className="animate-pulse border-b border-[#2C2C2C]">
            {Array.from({ length: columns }).map((_, i) => (
                <td key={i} className="px-6 py-4 whitespace-nowrap">
                    <div className="h-4 bg-[#2C2C2C] rounded w-full"></div>
                </td>
            ))}
        </tr>
    );
}
