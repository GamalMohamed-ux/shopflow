"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Scale,
  Save,
  History,
  Trash2,
  RefreshCw,
  GitCompare,
  Layers,
} from "lucide-react";

type Snapshot = {
  id: number;
  title: string;
  has_amount: number;
  receivable_amount: number;
  owed_amount: number;
  net_amount: number;
  created_at: string;
};

export default function NetBalanceTrackerPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [hasInput, setHasInput] = useState("");
  const [receivableInput, setReceivableInput] = useState("");
  const [owedInput, setOwedInput] = useState("");

  const [firstId, setFirstId] = useState<number | "">("");
  const [secondId, setSecondId] = useState<number | "">("");
  const [comparedPair, setComparedPair] = useState<{
    first: Snapshot;
    second: Snapshot;
  } | null>(null);

  const hasNum = Number(hasInput) || 0;
  const receivableNum = Number(receivableInput) || 0;
  const owedNum = Number(owedInput) || 0;
  const liveNet = hasNum + receivableNum - owedNum;

  const formatMoney = (val: number) =>
    new Intl.NumberFormat("ar-EG", {
      maximumFractionDigits: 2,
    }).format(Number(val || 0)) + " جنيه";

  const formatSignedMoney = (val: number) => {
    const absText = new Intl.NumberFormat("ar-EG", {
      maximumFractionDigits: 2,
    }).format(Math.abs(Number(val || 0)));
    if (val > 0) return `+${absText} جنيه`;
    if (val < 0) return `-${absText} جنيه`;
    return `0 جنيه`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const fetchSnapshots = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("balance_snapshots")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching snapshots:", error.message);
    } else if (data) {
      const parsed: Snapshot[] = data.map((row) => {
        const hasVal = Number(row.has_amount || 0);
        const recVal = Number(row.receivable_amount || 0);
        const owedVal = Number(row.owed_amount || 0);
        return {
          id: Number(row.id),
          title: String(row.title || ""),
          has_amount: hasVal,
          receivable_amount: recVal,
          owed_amount: owedVal,
          net_amount:
            row.net_amount !== undefined && row.net_amount !== null
              ? Number(row.net_amount)
              : hasVal + recVal - owedVal,
          created_at: String(row.created_at),
        };
      });

      setSnapshots(parsed);

      if (parsed.length >= 2) {
        setFirstId((prev) =>
          prev === "" || !parsed.some((p) => p.id === prev) ? parsed[0].id : prev
        );
        setSecondId((prev) =>
          prev === "" || !parsed.some((p) => p.id === prev) ? parsed[1].id : prev
        );
      } else if (parsed.length === 1) {
        setFirstId(parsed[0].id);
        setSecondId("");
      } else {
        setFirstId("");
        setSecondId("");
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSnapshots();

    const sub = supabase
      .channel("snapshots-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "balance_snapshots" },
        () => fetchSnapshots()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, []);

  const handleSaveSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      hasInput.trim() === "" &&
      receivableInput.trim() === "" &&
      owedInput.trim() === ""
    ) {
      alert("اكتب أي رقم الأول");
      return;
    }

    setSaving(true);
    const computedNet = hasNum + receivableNum - owedNum;
    const autoLabel = new Date().toLocaleDateString("ar-EG", {
      day: "numeric",
      month: "short",
    });

    const { error } = await supabase.from("balance_snapshots").insert({
      title: `حسبة ${autoLabel}`,
      has_amount: hasNum,
      receivable_amount: receivableNum,
      owed_amount: owedNum,
      net_amount: computedNet,
      created_at: new Date().toISOString(),
    });

    if (error) {
      alert("حصل خطأ أثناء الحفظ: " + error.message);
      setSaving(false);
      return;
    }

    setHasInput("");
    setReceivableInput("");
    setOwedInput("");
    await fetchSnapshots();
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    const ok = window.confirm("حذف هذا السجل؟");
    if (!ok) return;

    const { error } = await supabase
      .from("balance_snapshots")
      .delete()
      .eq("id", id);

    if (error) {
      alert("حصل خطأ أثناء الحذف: " + error.message);
      return;
    }

    if (comparedPair && (comparedPair.first.id === id || comparedPair.second.id === id)) {
      setComparedPair(null);
    }

    fetchSnapshots();
  };

  const handleRunComparison = () => {
    const first = snapshots.find((s) => s.id === Number(firstId));
    const second = snapshots.find((s) => s.id === Number(secondId));

    if (!first || !second) {
      alert("اختر الحسبة الأولى والحسبة الثانية الأول");
      return;
    }

    setComparedPair({ first, second });
  };

  const netDiff = comparedPair
    ? comparedPair.first.net_amount - comparedPair.second.net_amount
    : null;

  const hasDiff = comparedPair
    ? comparedPair.first.has_amount - comparedPair.second.has_amount
    : null;

  const receivableDiff = comparedPair
    ? comparedPair.first.receivable_amount - comparedPair.second.receivable_amount
    : null;

  const owedDiff = comparedPair
    ? comparedPair.first.owed_amount - comparedPair.second.owed_amount
    : null;
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white text-slate-900 p-4 sm:p-7"
    >
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="bg-white/95 border border-slate-200/80 rounded-3xl px-5 py-4 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-slate-950 via-slate-800 to-emerald-700 text-white flex items-center justify-center shadow-sm">
              <Layers className="w-5 h-5 text-emerald-300" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
              صافي
            </h1>
          </div>

          <button
            type="button"
            onClick={fetchSnapshots}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-bold text-slate-700 transition"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`}
            />
            تحديث
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-7 bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm">
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 mb-4">
              حسبة جديدة
            </h2>

            <form onSubmit={handleSaveSnapshot} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-3.5">
                  <label className="flex items-center justify-between text-xs font-extrabold text-emerald-800 mb-2">
                    <span>اللي معاك</span>
                    <Wallet className="w-4 h-4 text-emerald-600" />
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={hasInput}
                    onChange={(e) => setHasInput(e.target.value)}
                    className="w-full rounded-xl border border-emerald-200 bg-white focus:border-emerald-600 focus:outline-none px-3 py-2 text-base font-extrabold text-slate-900"
                  />
                </div>

                <div className="rounded-2xl border border-sky-200/80 bg-sky-50/40 p-3.5">
                  <label className="flex items-center justify-between text-xs font-extrabold text-sky-800 mb-2">
                    <span>اللي ليك</span>
                    <ArrowUpRight className="w-4 h-4 text-sky-600" />
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={receivableInput}
                    onChange={(e) => setReceivableInput(e.target.value)}
                    className="w-full rounded-xl border border-sky-200 bg-white focus:border-sky-600 focus:outline-none px-3 py-2 text-base font-extrabold text-slate-900"
                  />
                </div>

                <div className="rounded-2xl border border-rose-200/80 bg-rose-50/40 p-3.5">
                  <label className="flex items-center justify-between text-xs font-extrabold text-rose-800 mb-2">
                    <span>اللي عليك</span>
                    <ArrowDownLeft className="w-4 h-4 text-rose-600" />
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={owedInput}
                    onChange={(e) => setOwedInput(e.target.value)}
                    className="w-full rounded-xl border border-rose-200 bg-white focus:border-rose-600 focus:outline-none px-3 py-2 text-base font-extrabold text-slate-900"
                  />
                </div>
              </div>

              <div
                className={`rounded-2xl p-4 border flex items-center justify-between gap-3 ${
                  liveNet < 0
                    ? "bg-rose-50 border-rose-200"
                    : liveNet > 0
                    ? "bg-emerald-50 border-emerald-200"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Scale
                    className={`w-5 h-5 ${
                      liveNet < 0
                        ? "text-rose-600"
                        : liveNet > 0
                        ? "text-emerald-600"
                        : "text-slate-500"
                    }`}
                  />
                  <span className="text-sm font-extrabold text-slate-700">
                    النتيجة
                  </span>
                </div>

                <p
                  className={`text-xl sm:text-2xl font-black ${
                    liveNet < 0
                      ? "text-rose-700"
                      : liveNet > 0
                      ? "text-emerald-700"
                      : "text-slate-700"
                  }`}
                >
                  {formatSignedMoney(liveNet)}
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white py-3.5 px-5 text-sm font-extrabold shadow-sm transition disabled:opacity-50"
              >
                <Save className="w-4 h-4 text-emerald-400" />
                {saving ? "جاري الحفظ..." : "حفظ"}
              </button>
            </form>
          </section>

          <section className="lg:col-span-5 bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                  المقارنة
                </h2>
                <GitCompare className="w-5 h-5 text-indigo-600" />
              </div>

              {snapshots.length < 2 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center my-4">
                  <p className="text-sm font-bold text-slate-600">
                    احفظ حسبتين على الأقل للمقارنة
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      الحسبة الأولى
                    </label>
                    <select
                      value={firstId}
                      onChange={(e) => setFirstId(Number(e.target.value))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-900 focus:outline-none px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-800"
                    >
                      {snapshots.map((s) => (
                        <option key={s.id} value={s.id}>
                          {formatDate(s.created_at)} — {formatSignedMoney(s.net_amount)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      الحسبة الثانية
                    </label>
                    <select
                      value={secondId}
                      onChange={(e) => setSecondId(Number(e.target.value))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-900 focus:outline-none px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-800"
                    >
                      {snapshots.map((s) => (
                        <option key={s.id} value={s.id}>
                          {formatDate(s.created_at)} — {formatSignedMoney(s.net_amount)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleRunComparison}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-4 text-sm font-extrabold transition"
                  >
                    <GitCompare className="w-4 h-4" />
                    مقارنة
                  </button>

                  {comparedPair && (
                    <div className="space-y-2 bg-slate-50 rounded-2xl p-3.5 border border-slate-200/70 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-bold">الفرق في النتيجة</span>
                        <span
                          className={`text-sm font-black ${
                            (netDiff ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {formatSignedMoney(netDiff ?? 0)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/70">
                        <span className="text-slate-500 font-bold">اللي معاك</span>
                        <span
                          className={`font-extrabold ${
                            (hasDiff ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {formatSignedMoney(hasDiff ?? 0)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/70">
                        <span className="text-slate-500 font-bold">اللي ليك</span>
                        <span
                          className={`font-extrabold ${
                            (receivableDiff ?? 0) >= 0 ? "text-sky-700" : "text-rose-700"
                          }`}
                        >
                          {formatSignedMoney(receivableDiff ?? 0)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/70">
                        <span className="text-slate-500 font-bold">اللي عليك</span>
                        <span
                          className={`font-extrabold ${
                            (owedDiff ?? 0) <= 0 ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {formatSignedMoney(owedDiff ?? 0)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <p className="text-xs text-slate-400 mt-4">
              السجلات: {snapshots.length}
            </p>
          </section>
        </div>

        <section className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-slate-700" />
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
              السجل
            </h2>
          </div>

          {snapshots.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              لا توجد سجلات بعد.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {snapshots.map((item) => {
                const isNegative = item.net_amount < 0;
                const isPositive = item.net_amount > 0;

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200/90 bg-slate-50/50 hover:bg-white p-4 transition shadow-2xs flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-slate-500">
                          {formatDate(item.created_at)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        title="حذف"
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/70 text-xs">
                      <div className="bg-white rounded-xl p-2 border border-slate-100">
                        <span className="text-slate-400 block">معاك</span>
                        <span className="font-extrabold text-emerald-700 mt-0.5 block">
                          {formatMoney(item.has_amount)}
                        </span>
                      </div>

                      <div className="bg-white rounded-xl p-2 border border-slate-100">
                        <span className="text-slate-400 block">ليك</span>
                        <span className="font-extrabold text-sky-700 mt-0.5 block">
                          {formatMoney(item.receivable_amount)}
                        </span>
                      </div>

                      <div className="bg-white rounded-xl p-2 border border-slate-100">
                        <span className="text-slate-400 block">عليك</span>
                        <span className="font-extrabold text-rose-700 mt-0.5 block">
                          {formatMoney(item.owed_amount)}
                        </span>
                      </div>

                      <div
                        className={`rounded-xl p-2 border ${
                          isNegative
                            ? "bg-rose-50/80 border-rose-100"
                            : isPositive
                            ? "bg-emerald-50/80 border-emerald-100"
                            : "bg-slate-100/80 border-slate-200"
                        }`}
                      >
                        <span className="text-slate-500 block">النتيجة</span>
                        <span
                          className={`font-black mt-0.5 block ${
                            isNegative
                              ? "text-rose-700"
                              : isPositive
                              ? "text-emerald-700"
                              : "text-slate-700"
                          }`}
                        >
                          {formatSignedMoney(item.net_amount)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
