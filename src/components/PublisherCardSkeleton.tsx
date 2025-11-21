export default function PublisherCardSkeleton() {
    return (
        <div className="bg-gradient-to-br from-[#1E1E1E] to-[#161616] border border-[#2C2C2C] rounded-lg overflow-hidden">
            <div className="p-6 space-y-4 animate-pulse">
                {/* Header - Publisher Name & Domain */}
                <div>
                    <div className="h-6 bg-[#2C2C2C] rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-[#2C2C2C]/60 rounded w-1/2"></div>
                </div>

                {/* Risk Score */}
                <div>
                    <div className="flex items-baseline justify-between mb-2">
                        <div className="h-12 w-20 bg-[#2C2C2C] rounded"></div>
                        <div className="h-4 w-8 bg-[#2C2C2C]/60 rounded"></div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-[#2C2C2C] rounded-full h-2.5">
                        <div className="h-2.5 bg-[#2C2C2C]/40 rounded-full w-2/3"></div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <div className="h-6 w-20 bg-[#2C2C2C]/60 rounded-full"></div>
                        <div className="h-4 w-16 bg-[#2C2C2C]/40 rounded"></div>
                    </div>
                </div>

                {/* AI Category Badge */}
                <div className="flex items-center gap-2">
                    <div className="h-3 w-3 bg-[#2C2C2C]/60 rounded-full"></div>
                    <div className="h-4 w-24 bg-[#2C2C2C]/60 rounded"></div>
                    <div className="h-4 w-32 bg-[#2C2C2C]/40 rounded"></div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-[#0a0a0a] rounded p-2 border border-[#2C2C2C]">
                            <div className="h-3 bg-[#2C2C2C]/60 rounded w-full mb-2"></div>
                            <div className="h-5 bg-[#2C2C2C]/40 rounded w-2/3"></div>
                        </div>
                    ))}
                </div>

                {/* AI Summary Section */}
                <div className="bg-gradient-to-br from-cyan-950/20 to-blue-950/10 border border-cyan-600/20 rounded p-3">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="h-3 w-3 bg-[#2C2C2C]/60 rounded-full"></div>
                        <div className="h-4 w-24 bg-[#2C2C2C]/60 rounded"></div>
                        <div className="ml-auto h-3 w-20 bg-[#2C2C2C]/40 rounded"></div>
                    </div>
                    <div className="space-y-2">
                        <div className="h-3 bg-[#2C2C2C]/40 rounded w-full"></div>
                        <div className="h-3 bg-[#2C2C2C]/40 rounded w-5/6"></div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-[#2C2C2C] pt-3">
                    <div className="h-3 w-16 bg-[#2C2C2C]/40 rounded"></div>
                    <div className="h-3 w-24 bg-[#2C2C2C]/40 rounded"></div>
                </div>
            </div>
        </div>
    );
}
