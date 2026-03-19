import { HiOutlineInbox } from 'react-icons/hi2';

export default function EmptyState({ title = 'No data found', message = 'There are no items to display yet.', icon }) {
    return (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 px-6 py-14 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl text-sky-700">
                {icon || <HiOutlineInbox />}
            </div>
            <h3 className="mt-5 text-2xl font-bold text-slate-950">{title}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 sm:text-base">{message}</p>
        </div>
    );
}
