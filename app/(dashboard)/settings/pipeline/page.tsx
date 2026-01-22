'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api/client';
import { useAuth } from '@/hooks/use-auth';
import { Plus, GripVertical, Pencil, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Stage {
  id: string;
  name: string;
  color: string;
  position: number;
  isWon: boolean;
  isLost: boolean;
}

interface StageForm {
  name: string;
  color: string;
  isWon: boolean;
  isLost: boolean;
}

const defaultForm: StageForm = {
  name: '',
  color: '#6366f1',
  isWon: false,
  isLost: false,
};

function SortableRow({
  stage,
  isAdmin,
  onEdit,
  onDelete,
}: {
  stage: Stage;
  isAdmin: boolean;
  onEdit: (stage: Stage) => void;
  onDelete: (stage: Stage) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-10">
        {isAdmin && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
      </TableCell>
      <TableCell className="w-16">
        <div
          className="h-6 w-6 rounded border"
          style={{ backgroundColor: stage.color }}
        />
      </TableCell>
      <TableCell className="font-medium">{stage.name}</TableCell>
      <TableCell>
        {stage.isWon && (
          <Badge className="bg-green-100 text-green-800">Won Stage</Badge>
        )}
      </TableCell>
      <TableCell>
        {stage.isLost && (
          <Badge className="bg-red-100 text-red-800">Lost Stage</Badge>
        )}
      </TableCell>
      <TableCell className="w-24">
        {isAdmin && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(stage)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(stage)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

export default function PipelineSettingsPage() {
  const { user } = useAuth();
  const [stages, setStages] = useState<Stage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<Stage | null>(null);
  const [form, setForm] = useState<StageForm>(defaultForm);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteStage, setDeleteStage] = useState<Stage | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchStages = async () => {
    try {
      const response = await api.pipeline.listStages();
      if (response.data) {
        const data = response.data as { stages: Stage[] };
        setStages(data.stages.sort((a, b) => a.position - b.position));
      }
    } catch (error) {
      console.error('Failed to fetch stages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStages();
  }, []);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);

    const newStages = arrayMove(stages, oldIndex, newIndex);
    setStages(newStages);

    try {
      await api.pipeline.reorderStages(
        newStages.map((s, i) => ({ id: s.id, position: i }))
      );
    } catch (error) {
      console.error('Failed to reorder stages:', error);
      fetchStages();
    }
  };

  const openCreateDialog = () => {
    setEditingStage(null);
    setForm(defaultForm);
    setFormError('');
    setDialogOpen(true);
  };

  const openEditDialog = (stage: Stage) => {
    setEditingStage(stage);
    setForm({
      name: stage.name,
      color: stage.color,
      isWon: stage.isWon,
      isLost: stage.isLost,
    });
    setFormError('');
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');

    try {
      if (editingStage) {
        await api.pipeline.updateStage(editingStage.id, {
          name: form.name,
          color: form.color,
          isWon: form.isWon,
          isLost: form.isLost,
        });
      } else {
        await api.pipeline.createStage({
          name: form.name,
          color: form.color,
          isWon: form.isWon,
          isLost: form.isLost,
          position: stages.length,
        });
      }
      setDialogOpen(false);
      fetchStages();
    } catch (err: unknown) {
      const error = err as { error?: { message?: string; details?: Record<string, string[]> } };
      if (error.error?.details) {
        const messages = Object.values(error.error.details).flat();
        setFormError(messages.join('. '));
      } else {
        setFormError(error.error?.message || 'Failed to save stage');
      }
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteStage) return;
    setDeleteLoading(true);
    setDeleteError('');

    try {
      await api.pipeline.deleteStage(deleteStage.id);
      setDeleteStage(null);
      fetchStages();
    } catch (err: unknown) {
      const error = err as { error?: { message?: string } };
      setDeleteError(error.error?.message || 'Failed to delete stage');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <Header
        title="Pipeline Stages"
        description="Configure your sales pipeline stages"
        actions={
          isAdmin && (
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-1" />
              Add Stage
            </Button>
          )
        }
      />

      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Stages ({stages.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
              </div>
            ) : stages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No pipeline stages yet. Create one to get started.
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="w-16">Color</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Won</TableHead>
                      <TableHead>Lost</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <SortableContext
                      items={stages.map((s) => s.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {stages.map((stage) => (
                        <SortableRow
                          key={stage.id}
                          stage={stage}
                          isAdmin={isAdmin}
                          onEdit={openEditDialog}
                          onDelete={setDeleteStage}
                        />
                      ))}
                    </SortableContext>
                  </TableBody>
                </Table>
              </DndContext>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStage ? 'Edit Stage' : 'Create Stage'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={100}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="h-10 w-14 rounded border cursor-pointer"
                />
                <Input
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  pattern="^#[0-9A-Fa-f]{6}$"
                  className="w-28 font-mono"
                />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isWon"
                  checked={form.isWon}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, isWon: !!checked, isLost: checked ? false : form.isLost })
                  }
                />
                <Label htmlFor="isWon" className="cursor-pointer">
                  Mark as &quot;Won&quot; stage
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isLost"
                  checked={form.isLost}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, isLost: !!checked, isWon: checked ? false : form.isWon })
                  }
                />
                <Label htmlFor="isLost" className="cursor-pointer">
                  Mark as &quot;Lost&quot; stage
                </Label>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Only one stage can be marked as &quot;Won&quot; and one as &quot;Lost&quot;.
            </p>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={formLoading}>
                {formLoading ? 'Saving...' : editingStage ? 'Update' : 'Create'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteStage} onOpenChange={(open) => !open && setDeleteStage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stage</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the stage &quot;{deleteStage?.name}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <Alert variant="destructive">
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
