import React, { useState } from "react";
import { useSharedInventoryMatches } from "../hooks/useSharedInventoryMatches";
import { Sparkles, X, Car, MessageSquare, ExternalLink, ShieldAlert, Award } from "lucide-react";
import { VehicleDetailModal } from "./VehicleDetailModal";
import { Vehicle, Client } from "../types";
import { useIsMobile } from "../hooks/useIsMobile";
import clsx from "clsx";

export function SharedMatchNotifications() {
  const { ownAgencySharing, matches, loading } = useSharedInventoryMatches();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const isMobile = useIsMobile();

  // If mobile, or there are no matches, or we are loading, we don't render the notification widget
  if (isMobile || loading || matches.length === 0) return null;

  return (
    <>
      {/* Floating Toggle Button with Pulse Effect */}
      <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-full shadow-2xl shadow-amber-500/30 transition-all hover:scale-105 active:scale-95 font-bold text-sm animate-pulse"
          >
            <Sparkles className="w-5 h-5 shrink-0" />
            <span>
              {matches.length} {matches.length === 1 ? "Match en Red" : "Matches en Red"}
            </span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
          </button>
        )}

        {/* Collapsible Panel */}
        {isOpen && (
          <div className="bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900 shadow-2xl rounded-2xl w-80 md:w-96 max-h-[480px] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 animate-pulse" />
                <div>
                  <h4 className="font-extrabold text-sm tracking-tight">Oportunidades de Red</h4>
                  <p className="text-[10px] text-amber-100 font-medium">Coincidencias en inventario compartido</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/20 rounded-lg text-white/90 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50 dark:bg-slate-900">
              {matches.map((match, idx) => {
                const percentage = match.score;
                return (
                  <div
                    key={`${match.vehicle.id}-${match.client.id}-${idx}`}
                    className="p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl shadow-sm flex flex-col gap-2 hover:border-amber-300 dark:hover:border-amber-800/80 transition-colors group"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200/40">
                        {match.level === "exact" ? "Match Perfecto" : `Coincidencia ${percentage}%`}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold truncate max-w-[120px]">
                        {match.agencyName}
                      </span>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 p-2 rounded-lg shrink-0 mt-0.5">
                        <Car className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          {match.vehicle.make} {match.vehicle.model}
                        </h5>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Año {match.vehicle.year} • ${match.vehicle.price?.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-slate-100 dark:border-slate-700 pt-2 mt-1">
                      <p className="text-[10px] text-slate-600 dark:text-slate-400">
                        Buscado por el cliente: <span className="font-extrabold text-slate-900 dark:text-white">{match.client.name}</span>
                      </p>
                    </div>

                    {/* Interactive Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        onClick={() => {
                          setSelectedVehicle(match.vehicle);
                          setSelectedClient(match.client);
                        }}
                        className="py-1.5 px-2 bg-slate-100 dark:bg-slate-700 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-600 text-[10px] font-bold rounded-lg text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Ver Auto
                      </button>
                      <a
                        href={`https://wa.me/${match.client.phone?.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-1.5 px-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-500 hover:text-white text-[10px] font-bold rounded-lg text-emerald-700 dark:text-emerald-300 transition-colors flex items-center justify-center gap-1"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        WhatsApp Cliente
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Render the full Interactive VehicleDetailModal when selected */}
      {selectedVehicle && selectedClient && (
        <VehicleDetailModal
          vehicle={selectedVehicle}
          clientContext={selectedClient}
          onClose={() => {
            setSelectedVehicle(null);
            setSelectedClient(null);
          }}
        />
      )}
    </>
  );
}
