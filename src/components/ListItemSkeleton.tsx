export default function ListItemSkeleton() {
    return (
        <div className="p-3 bg-gradient-to-br from-[#0E0E0E] to-[#161616]/50 rounded-lg border border-[#2C2C2C]/50 animate-pulse">
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <div className="h-4 bg-[#2C2C2C] rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-[#2C2C2C]/60 rounded w-1/2"></div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-6 w-16 bg-[#2C2C2C] rounded-md"></div>
                    <div className="h-4 w-4 bg-[#2C2C2C] rounded-full"></div>
                </div>
            </div>
        </div>
    );
}
