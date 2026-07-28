import { redirect } from 'next/navigation';

interface PageProps {
  params: {
    id: string;
  };
}

export default function SessionAnalysisPage({ params }: PageProps) {
  redirect(`/sessions/${params.id}`);
}
