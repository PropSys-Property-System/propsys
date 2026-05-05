'use client';

import React, { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth/auth-context';
import {
  listReceiptPaymentProofsForReceipt,
  loadResidentReceiptDetailData,
  uploadReceiptPaymentProof,
} from '@/lib/features/receipts/receipts-center.data';
import { ResidentPaymentProofPanel, ResidentReceiptDetailView, ResidentReceiptHeaderActions } from '@/lib/features/receipts/receipts-center.ui';
import type { Building as BuildingType, Receipt, ReceiptPaymentProofView, Unit as UnitType } from '@/lib/types';

interface PageParams {
  id: string;
}

export default function ResidentReceiptDetailPage({ params }: { params: Promise<PageParams> }) {
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
  const [proofs, setProofs] = useState<ReceiptPaymentProofView[]>([]);
  const [selectedProofFile, setSelectedProofFile] = useState<File | null>(null);
  const [proofNote, setProofNote] = useState('');
  const [isUploadingProof, setIsUploadingProof] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setLoadError(null);
        const data = await loadResidentReceiptDetailData(user, resolvedParams.id);
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
              onClick={() => router.push('/resident/receipts')}
              className="flex items-center bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              Volver a mis recibos
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
          description="No pudimos encontrar el recibo solicitado."
          action={
            <button
              onClick={() => router.push('/resident/receipts')}
              className="flex items-center bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              Volver a mis recibos
            </button>
          }
        />
      </div>
    );
  }

  function printReceipt() {
    window.print();
  }

  async function handleUploadProof(target: Receipt) {
    if (!user) return;
    if (!selectedProofFile) {
      setActionError('Selecciona un archivo PDF o imagen del comprobante.');
      return;
    }
    try {
      setIsUploadingProof(true);
      setActionError(null);
      setActionMessage(null);
      const proof = await uploadReceiptPaymentProof(user, { receiptId: target.id, file: selectedProofFile, note: proofNote });
      setProofs((current) => [proof, ...current]);
      setSelectedProofFile(null);
      setProofNote('');
      setActionMessage('Comprobante enviado. Queda pendiente de revisión por la administración.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No pudimos subir el comprobante.');
    } finally {
      setIsUploadingProof(false);
    }
  }

  function openProof(proof: ReceiptPaymentProofView) {
    window.open(proof.fileUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <>
      {actionError ? (
        <div className="bg-rose-50 border-b border-rose-100 px-6 py-3 text-sm font-bold text-rose-700">{actionError}</div>
      ) : null}
      {actionMessage ? (
        <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-3 text-sm font-bold text-emerald-700">{actionMessage}</div>
      ) : null}
      <ResidentReceiptDetailView
        receipt={receipt}
        building={building}
        unit={unit}
        paymentProofPanel={
          <ResidentPaymentProofPanel
            receipt={receipt}
            proofs={proofs}
            selectedFile={selectedProofFile}
            note={proofNote}
            isSubmitting={isUploadingProof}
            onFileChange={setSelectedProofFile}
            onNoteChange={setProofNote}
            onUpload={() => handleUploadProof(receipt)}
            onOpenProof={openProof}
          />
        }
        actions={
          <ResidentReceiptHeaderActions
            receipt={receipt}
            receiptStatus={receipt.status}
            onPrint={printReceipt}
          />
        }
      />
    </>
  );
}
