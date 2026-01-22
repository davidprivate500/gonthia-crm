'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api/client';
import { Plus, Settings, DollarSign } from 'lucide-react';
import { DealCard } from '@/components/pipeline/deal-card';
import { NewDealDialog } from '@/components/pipeline/new-deal-dialog';
import { DealDetailSheet } from '@/components/pipeline/deal-detail-sheet';

interface Deal {
  id: string;
  title: string;
  value: string | null;
  currency: string;
  position: number;
  contact: { id: string; firstName: string; lastName: string } | null;
  company: { id: string; name: string } | null;
  owner: { id: string; firstName: string | null; lastName: string | null } | null;
}

interface Stage {
  id: string;
  name: string;
  color: string | null;
  position: number;
  isWon: boolean;
  isLost: boolean;
  deals: Deal[];
}

interface PipelineSummary {
  totalDeals: number;
  totalValue: number;
  stageCount: number;
}

export default function PipelinePage() {
  const [board, setBoard] = useState<Stage[]>([]);
  const [summary, setSummary] = useState<PipelineSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<string | null>(null);
  const [draggedDeal, setDraggedDeal] = useState<{ dealId: string; stageId: string } | null>(null);

  const fetchBoard = useCallback(async () => {
    try {
      const response = await api.pipeline.getBoard();
      const data = response.data as { board?: Stage[]; summary?: PipelineSummary } | undefined;
      if (data) {
        setBoard(data.board || []);
        setSummary(data.summary || null);
      }
    } catch (error) {
      console.error('Failed to fetch pipeline:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const handleDragStart = (e: React.DragEvent, dealId: string, stageId: string) => {
    setDraggedDeal({ dealId, stageId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    if (!draggedDeal || draggedDeal.stageId === targetStageId) {
      setDraggedDeal(null);
      return;
    }

    // Optimistic update
    const updatedBoard = board.map((stage) => {
      if (stage.id === draggedDeal.stageId) {
        return {
          ...stage,
          deals: stage.deals.filter((d) => d.id !== draggedDeal.dealId),
        };
      }
      if (stage.id === targetStageId) {
        const deal = board
          .find((s) => s.id === draggedDeal.stageId)
          ?.deals.find((d) => d.id === draggedDeal.dealId);
        if (deal) {
          return {
            ...stage,
            deals: [...stage.deals, deal],
          };
        }
      }
      return stage;
    });

    setBoard(updatedBoard);
    setDraggedDeal(null);

    // API call
    try {
      await api.deals.move(draggedDeal.dealId, { stageId: targetStageId });
    } catch (error) {
      console.error('Failed to move deal:', error);
      fetchBoard(); // Revert on error
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <>
      <Header
        title="Pipeline"
        description={
          summary
            ? `${summary.totalDeals} deals worth $${summary.totalValue.toLocaleString()}`
            : undefined
        }
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a href="/settings/pipeline">
                <Settings className="h-4 w-4 mr-1" />
                Manage Stages
              </a>
            </Button>
            <Button onClick={() => setNewDealOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Deal
            </Button>
          </div>
        }
      />

      <div className="p-6 h-[calc(100vh-140px)] overflow-hidden">
        {board.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Card className="max-w-md text-center">
              <CardContent className="pt-6">
                <p className="text-gray-500 mb-4">
                  No pipeline stages configured yet. Set up your sales stages to
                  start tracking deals.
                </p>
                <Button asChild>
                  <a href="/settings/pipeline">Configure Pipeline</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex gap-4 h-full overflow-x-auto pb-4">
            {board.map((stage) => (
              <div
                key={stage.id}
                className="flex-shrink-0 w-80"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                <Card className="h-full flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: stage.color || '#6366f1' }}
                        />
                        <CardTitle className="text-base">{stage.name}</CardTitle>
                      </div>
                      <span className="text-sm text-gray-500">
                        {stage.deals.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <DollarSign className="h-3 w-3" />
                      {stage.deals
                        .reduce((sum, d) => sum + (d.value ? parseFloat(d.value) : 0), 0)
                        .toLocaleString()}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-y-auto space-y-2">
                    {stage.deals.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        onDragStart={(e) => handleDragStart(e, deal.id, stage.id)}
                        onClick={() => setSelectedDeal(deal.id)}
                      />
                    ))}
                    {stage.deals.length === 0 && (
                      <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed rounded-lg">
                        Drop deals here
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>

      <NewDealDialog
        open={newDealOpen}
        onOpenChange={setNewDealOpen}
        stages={board}
        onSuccess={fetchBoard}
      />

      <DealDetailSheet
        dealId={selectedDeal}
        onClose={() => setSelectedDeal(null)}
        onUpdate={fetchBoard}
      />
    </>
  );
}
