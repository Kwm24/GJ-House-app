import { JobFilesList } from "../JobFilesList.jsx";

export function ResourcesTab({ jobId }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Reference Files</p>
        <JobFilesList
          jobId={jobId}
          fileType="reference"
          emptyMessage="No reference files from CS yet."
        />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Customer Resources</p>
        <JobFilesList
          jobId={jobId}
          fileType="customer_upload"
          emptyMessage="No files uploaded by the customer yet."
        />
      </div>
    </div>
  );
}
