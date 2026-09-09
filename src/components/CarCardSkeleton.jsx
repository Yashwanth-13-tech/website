import React from 'react'

export default function CarCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-0 shadow-xs animate-pulse">
      {/* Top Image box */}
      <div className="w-full aspect-[16/9] bg-slate-200" />

      {/* Body */}
      <div className="flex flex-1 flex-col p-3.5 sm:p-4 space-y-2.5">
        <div className="flex justify-between items-start">
          <div className="space-y-1.5 w-3/4">
            <div className="h-3 w-1/3 bg-slate-200 rounded-md" />
            <div className="h-5 w-4/5 bg-slate-200 rounded-md" />
          </div>
          <div className="h-5 w-10 bg-slate-200 rounded-lg" />
        </div>

        {/* Specs 3-column grid */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          <div className="h-7 bg-slate-100 rounded-lg" />
          <div className="h-7 bg-slate-100 rounded-lg" />
          <div className="h-7 bg-slate-100 rounded-lg" />
        </div>

        {/* Location pill */}
        <div className="h-4 w-2/3 bg-slate-100 rounded-md mt-1" />

        {/* Pricing & CTA */}
        <div className="pt-2.5 border-t border-slate-100 flex justify-between items-end mt-1">
          <div className="h-6 w-20 bg-slate-200 rounded-md" />
          <div className="h-8 w-24 bg-accent-100 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
