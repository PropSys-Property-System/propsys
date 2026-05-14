'use client';

import React, { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth/auth-context';
import {
  editAdminReceipt,
  listReceiptPaymentProofsForReceipt,
  loadAdminReceiptDetailData,
  removeAdminReceipt,
  reviewReceiptPaymentProof,
  updateAdminReceiptStatus,
} from '@/lib/features/receipts/receipts-center.data';
import { AdminPaymentProofsPanel, AdminReceiptDetailView, AdminReceiptHeaderActions } from '@/lib/features/receipts/receipts-center.ui';
import type { Building as BuildingType, Receipt, ReceiptPaymentProofReviewAction, ReceiptPaymentProofView, Unit as UnitType } from '@/lib/types';

export default function AdminReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { user } = useAuth();
  const resolvedParams = use(params);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [building, setBuilding] = useState<BuildingType | null>(null);
  const [unit, setUnit] = useState<UnitType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [pendingProofActionId, setPendingProofActionId] = useState<string | null>(null);
  const [proofs, setProofs] = useState<ReceiptPaymentProofView[]>([]);
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editCurrency, setEditCurrency] = useState('PEN');
  const [editDescription, setEditDescription] = useState('');
  const [editIssueDate, setEditIssueDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setLoadError(null);
        const data = await loadAdminReceiptDetailData(user, resolvedParams.id);
        const loadedProofs = data.receipt ? await listReceiptPaymentProofsForReceipt(user, data.receipt.id).catch(() => []) : [];
        if (!isMounted) return;
        setReceipt(data.receipt);
        setBuilding(data.building);
        setUnit(data.unit);
        setProofs(loadedProofs);
      } catch {
        if (!isMounted) return;
        setLoadError('No pudimos cargar el recibo.');
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [resolvedParams.id, user]);

  const hasUploadedProof = proofs.length > 0;
  const editDisabledReason = hasUploadedProof
    ? 'No puedes editar este recibo porque ya tiene un comprobante de pago cargado.'
    : null;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <LoadingState title="Cargando recibo..." />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <ErrorState
          title="Error"
          description={loadError}
          action={
            <button
              onClick={() => router.push('/admin/receipts')}
              className="flex items-center bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              Volver a la lista
            </button>
          }
        />
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <ErrorState
          title="Recibo no encontrado"
          description="El identificador del recibo no existe o ha sido eliminado."
          action={
            <button
              onClick={() => router.push('/admin/receipts')}
              className="flex items-center bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              Volver a la lista
            </button>
          }
        />
      </div>
    );
  }

  async function handleReceiptStatusChange(target: Receipt, status: 'PAID' | 'CANCELLED') {
    if (!user || target.status !== 'PENDING') return;

    const actionLabel = status === 'PAID' ? 'marcar como pagado' : 'anular';
    const confirmed = window.confirm(`Quieres ${actionLabel} el recibo ${target.number}?`);
    if (!confirmed) return;

    const nextActionId = `${target.id}:${status}`;
    try {
      setPendingActionId(nextActionId);
      setActionError(null);
      setActionMessage(null);
      const updated = await updateAdminReceiptStatus(user, { receiptId: target.id, status });
      setReceipt(updated);
      setActionMessage(`Recibo ${updated.number} actualizado.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No pudimos actualizar el recibo.');
    } finally {
      setPendingActionId(null);
    }
  }

  function openProof(proof: ReceiptPaymentProofView) {
    window.open(proof.fileUrl, '_blank', 'noopener,noreferrer');
  }

  function handleReviewCommentChange(proofId: string, comment: string) {
    setReviewComments((current) => ({ ...current, [proofId]: comment }));
  }

  async function handleReviewProof(proofId: string, action: ReceiptPaymentProofReviewAction) {
    if (!user) return;

    const nextActionId = `${proofId}:${action}`;
    try {
      setPendingProofActionId(nextActionId);
      setActionError(null);
      setActionMessage(null);
      const result = await reviewReceiptPaymentProof(user, {
        proofId,
        action,
        reviewComment: reviewComments[proofId],
      });
      setProofs((current) => current.map((proof) => (proof.id === result.proof.id ? result.proof : proof)));
      setReviewComments((current) => {
        const next = { ...current };
        delete next[proofId];
        return next;
      });
      setReceipt((current) => (current && current.id === result.receipt.id ? { ...current, status: result.receipt.status } : current));
      setActionMessage(action === 'APPROVE' ? 'Comprobante aprobado y recibo marcado como pagado.' : 'Comprobante rechazado. El recibo permanece pendiente.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No pudimos revisar el comprobante.');
    } finally {
      setPendingProofActionId(null);
    }
  }

  function printReceipt() {
    window.print();
  }

  function openEdit(target: Receipt) {
    if (hasUploadedProof) {
      setActionError('No puedes editar este recibo porque ya tiene un comprobante de pago cargado.');
      setActionMessage(null);
      return;
    }
    setEditAmount(String(target.amount));
    setEditCurrency(target.currency);
    setEditDescription(target.description);
    setEditIssueDate(target.issueDate.slice(0, 10));
    setEditDueDate(target.dueDate.slice(0, 10));
    setIsEditOpen(true);
    setActionError(null);
    setActionMessage(null);
  }

  async function submitEdit() {
    if (!user || !receipt) return;
    if (hasUploadedProof) {
      setActionError('No puedes editar este recibo porque ya tiene un comprobante de pago cargado.');
      setActionMessage(null);
      return;
    }
    const amount = Number(editAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !editDescription.trim() || !editIssueDate || !editDueDate) {
      setActionError('Completa monto, descripcion y fechas validas.');
      return;
    }
    try {
      setIsEditSubmitting(true);
      setActionError(null);
      setActionMessage(null);
      const updated = await editAdminReceipt(user, {
        receiptId: receipt.id,
        amount,
        currency: editCurrency,
        description: editDescription.trim(),
        issueDate: editIssueDate,
        dueDate: editDueDate,
      });
      setReceipt(updated);
      setIsEditOpen(false);
      setActionMessage(`Recibo ${updated.number} actualizado.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No pudimos editar el recibo.');
    } finally {
      setIsEditSubmitting(false);
    }
  }

  async function handleDelete(target: Receipt) {
    if (!user) return;
    const confirmed = window.confirm(`Eliminar el recibo ${target.number}? Esta accion no se puede deshacer.`);
    if (!confirmed) return;
    try {
      setIsDeleting(true);
      setActionError(null);
      setActionMessage(null);
      await removeAdminReceipt(user, target.id);
      router.push('/admin/receipts');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No pudimos eliminar el recibo.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      {actionError ? (
        <div className="bg-rose-50 border-b border-rose-100 px-6 py-3 text-sm font-bold text-rose-700">
          {actionError}
        </div>
      ) : null}
      {actionMessage ? (
        <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-3 text-sm font-bold text-emerald-700">
          {actionMessage}
        </div>
      ) : null}
      <AdminReceiptDetailView
        receipt={receipt}
        building={building}
        unit={unit}
        onDelete={handleDelete}
        isDeleting={isDeleting}
        paymentProofPanel={
          <AdminPaymentProofsPanel
            receipt={receipt}
            emptyDescription="Este recibo aún no tiene comprobantes registrados."
            proofs={proofs}
            pendingActionId={pendingProofActionId}
            reviewComments={reviewComments}
            buildingById={new Map(building ? [[building.id, { id: building.id, name: building.name }]] : [])}
            unitById={new Map(unit ? [[unit.id, { id: unit.id, buildingId: unit.buildingId, number: unit.number }]] : [])}
            onOpenProof={openProof}
            onReviewCommentChange={handleReviewCommentChange}
            onApprove={(proofId) => handleReviewProof(proofId, 'APPROVE')}
            onReject={(proofId) => handleReviewProof(proofId, 'REJECT')}
          />
        }
        actions={
          <AdminReceiptHeaderActions
            receipt={receipt}
            pendingActionId={pendingActionId}
            onMarkPaid={(item) => handleReceiptStatusChange(item, 'PAID')}
            onCancelReceipt={(item) => handleReceiptStatusChange(item, 'CANCELLED')}
            onEdit={hasUploadedProof ? undefined : openEdit}
            editDisabledReason={editDisabledReason}
            onPrint={printReceipt}
          />
        }
      />
      {isEditOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/30" onClick={() => setIsEditOpen(false)} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <p className="text-lg font-black text-slate-900">Editar recibo</p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <input type="number" min="0" step="0.01" value={editAmount} onChange={(event) => setEditAmount(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Monto" />
              <select value={editCurrency} onChange={(event) => setEditCurrency(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="PEN">PEN</option>
                <option value="USD">USD</option>
              </select>
              <input type="date" value={editIssueDate} onChange={(event) => setEditIssueDate(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input type="date" value={editDueDate} onChange={(event) => setEditDueDate(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2"
                placeholder="Descripcion"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setIsEditOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void submitEdit()}
                disabled={isEditSubmitting}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {isEditSubmitting ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
