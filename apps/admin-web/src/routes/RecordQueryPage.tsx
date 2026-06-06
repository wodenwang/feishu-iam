import { RecordQueryView } from '../features/records/RecordQueryView';

export type RecordQueryPageProps = {
  initialApplicationId?: string | null;
};

export function RecordQueryPage({ initialApplicationId }: RecordQueryPageProps) {
  return <RecordQueryView initialApplicationId={initialApplicationId} />;
}
