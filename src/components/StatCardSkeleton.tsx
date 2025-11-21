export default function StatCardSkeleton() {
    return (
        <div className="bg-gradient-to-br from-[#0E0E0E] via-[#161616] to-[#0E0E0E] rounded-xl p-4 border border-[#48a77f]/10 animate-pulse">
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <div className="h-3 bg-[#2C2C2C] rounded w-2/3 mb-3"></div>
                    <div className="h-8 bg-[#2C2C2C] rounded w-1/2"></div>
                </div>
                <div className="bg-[#2C2C2C] p-3 rounded-lg w-11 h-11"></div>
            </div>
        </div>
    );
}
