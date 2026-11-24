"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Wallet,
  HandCoins,
  Scale,
  Save,
  History,
  Trash2,
  RefreshCw,
  GitCompare,
  Calendar,
  Sparkles,
} from "lucide-react";

type Snapshot = {
  id: number;
  title: string;
  has_amount: number;
  owed_amount: number;
  net_amount: number;
  created_at: string;
};

export default function NetBalanceTrackerPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [hasInput, setHasInput] = useState("");
  const [owedInput, setOwedInput] = useState("");

  const [compareId, setCompareId] = useState<number | "">("");

  const hasNum = Number(hasInput) || 0;
  const owedNum = Number(owedInput) || 0;
  const liveNet = hasNum - owedNum;

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
      const parsed: Snapshot[] = data.map((row) => ({
        id: Number(row.id),
        title: String(row.title || ""),
        has_amount: Number(row.has_amount || 0),
        owed_amount: Number(row.owed_amount || 0),
        net_amount: Number(row.net_amount || 0),
        created_at: String(row.created_at),
      }));
      setSnapshots(parsed);
      if (parsed.length > 1) {
        setCompareId((prev) =>
          prev === "" || !parsed.some((p) => p.id === prev) ? parsed[1].id : prev
        );
      } else if (parsed.length === 1) {
        setCompareId(parsed[0].id);
      } else {
        setCompareId("");
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
    if (hasInput.trim() === "" && owedInput.trim() === "") {
      alert("اكتب الفلوس اللي معاك أو اللي عليك الأول");
      return;
    }

    setSaving(true);
    const computedNet = hasNum - owedNum;
    const finalTitle =
      title.trim() ||
      `حسبة ${new Date().toLocaleDateString("ar-EG", {
        day: "numeric",
        month: "short",
      })}`;

    const { error } = await supabase.from("balance_snapshots").insert({
      title: finalTitle,
      has_amount: hasNum,
      owed_amount: owedNum,
      net_amount: computedNet,
      created_at: new Date().toISOString(),
    });

    if (error) {
      alert("حصل خطأ أثناء الحفظ: " + error.message);
      setSaving(false);
      return;
    }

    setTitle("");
    setHasInput("");
    setOwedInput("");
    await fetchSnapshots();
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    const ok = window.confirm("هل تريد حذف هذه الحسبة المحفوظة؟");
    if (!ok) return;

    const { error } = await supabase
      .from("balance_snapshots")
      .delete()
      .eq("id", id);

    if (error) {
      alert("حصل خطأ أثناء الحذف: " + error.message);
      return;
    }
    fetchSnapshots();
  };

  const latestSnapshot = snapshots[0] || null;
  const comparedSnapshot =
    snapshots.find((s) => s.id === Number(compareId)) || null;

  const netChangeBetween =
    latestSnapshot && comparedSnapshot
      ? latestSnapshot.net_amount - comparedSnapshot.net_amount
      : null;

  const hasChangeBetween =
    latestSnapshot && comparedSnapshot
      ? latestSnapshot.has_amount - comparedSnapshot.has_amount
      : null;

  const owedChangeBetween =
    latestSnapshot && comparedSnapshot
      ? latestSnapshot.owed_amount - comparedSnapshot.owed_amount
      : null;
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white text-slate-900 p-4 sm:p-7"
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* الهيدر */}
        <header className="bg-white/90 backdrop-blur border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
              <Sparkles className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                ميزان الحسابات — حفظ ومقارنة الفترات
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                احسب اللي معاك واللي عليك، احفظ كل حسبة، وقارن بين الأسابيع والشهور
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchSnapshots}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-bold text-slate-700 transition"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`}
            />
            تحديث
          </button>
        </header>

        {/* الحاسبة الفورية + نتيجة الصافي */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* إدخال وحفظ الحسبة */}
          <section className="lg:col-span-7 bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-extrabold text-slate-900">
                حسبة جديدة وحفظ (Save)
              </h2>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600">
                حفظ تلقائي للسجل
              </span>
            </div>

            <form onSubmit={handleSaveSnapshot} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  اسم أو وصف الحسبة (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="مثال: جرد الأسبوع الأول، تقفيل شهر نوفمبر..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-slate-900 focus:outline-none px-4 py-2.5 text-sm font-medium transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4">
                  <label className="flex items-center justify-between text-xs font-extrabold text-emerald-800 mb-2">
                    <span>الفلوس اللي معاك</span>
                    <Wallet className="w-4 h-4 text-emerald-600" />
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={hasInput}
                    onChange={(e) => setHasInput(e.target.value)}
                    className="w-full rounded-xl border border-emerald-200 bg-white focus:border-emerald-600 focus:outline-none px-3.5 py-2.5 text-base font-extrabold text-slate-900"
                  />
                </div>

                <div className="rounded-2xl border border-rose-200/80 bg-rose-50/40 p-4">
                  <label className="flex items-center justify-between text-xs font-extrabold text-rose-800 mb-2">
                    <span>الفلوس اللي عليك</span>
                    <HandCoins className="w-4 h-4 text-rose-600" />
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={owedInput}
                    onChange={(e) => setOwedInput(e.target.value)}
                    className="w-full rounded-xl border border-rose-200 bg-white focus:border-rose-600 focus:outline-none px-3.5 py-2.5 text-base font-extrabold text-slate-900"
                  />
                </div>
              </div>

              {/* معاينة النتيجة قبل الحفظ */}
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
                  <div>
                    <p className="text-xs font-bold text-slate-600">
                      نتيجة الحسبة الآن
                    </p>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">
                      {liveNet < 0
                        ? `عليك عجز / ناقص ${formatMoney(Math.abs(liveNet))}`
                        : liveNet > 0
                        ? `معاك فائض / زيادة ${formatMoney(liveNet)}`
                        : "الحساب متعادل (0)"}
                    </p>
                  </div>
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
                {saving ? "جاري الحفظ..." : "حفظ الحسبة (Save)"}
              </button>
            </form>
          </section>

          {/* مقارنة الفترات */}
          <section className="lg:col-span-5 bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-extrabold text-slate-900">
                  مقارنة بين فترتين
                </h2>
                <GitCompare className="w-5 h-5 text-indigo-600" />
              </div>

              {snapshots.length < 2 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center space-y-2 my-4">
                  <p className="text-sm font-bold text-slate-700">
                    احفظ حسبتين على الأقل عشان تقارن بينهم
                  </p>
                  <p className="text-xs text-slate-500">
                    مثلاً حسبة الأسبوع ده مع الأسبوع اللي فات، أو الشهر ده مع الشهر اللي فات.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">
                      قارن أحدث حسبة ({latestSnapshot?.title}) مع:
                    </label>
                    <select
                      value={compareId}
                      onChange={(e) => setCompareId(Number(e.target.value))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-slate-900 focus:outline-none px-3.5 py-2.5 text-sm font-bold text-slate-800"
                    >
                      {snapshots.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title} — ({formatDate(s.created_at)}) —{" "}
                          {formatSignedMoney(s.net_amount)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {latestSnapshot && comparedSnapshot && (
                    <div className="space-y-3 bg-slate-50 rounded-2xl p-4 border border-slate-200/70">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-semibold">
                          الفرق في الصافي
                        </span>
                        <span
                          className={`text-sm font-black ${
                            (netChangeBetween ?? 0) >= 0
                              ? "text-emerald-700"
                              : "text-rose-700"
                          }`}
                        >
                          {formatSignedMoney(netChangeBetween ?? 0)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/70">
                        <span className="text-slate-500 font-semibold">
                          الفرق في اللي معاك
                        </span>
                        <span
                          className={`font-extrabold ${
                            (hasChangeBetween ?? 0) >= 0
                              ? "text-emerald-700"
                              : "text-rose-700"
                          }`}
                        >
                          {formatSignedMoney(hasChangeBetween ?? 0)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/70">
                        <span className="text-slate-500 font-semibold">
                          الفرق في اللي عليك
                        </span>
                        <span
                          className={`font-extrabold ${
                            (owedChangeBetween ?? 0) <= 0
                              ? "text-emerald-700"
                              : "text-rose-700"
                          }`}
                        >
                          {formatSignedMoney(owedChangeBetween ?? 0)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <p className="text-xs text-slate-400 mt-4">
              إجمالي الحسابات المحفوظة: {snapshots.length}
            </p>
          </section>
        </div>

        {/* سجل الحسابات المحفوظة */}
        <section className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-slate-700" />
              <h2 className="text-lg font-extrabold text-slate-900">
                الحسابات المحفوظة (السجل)
              </h2>
            </div>
          </div>

          {snapshots.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              لا توجد حسابات محفوظة بعد. ابدأ بإدخال الأرقام وحفظ أول حسبة.
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
                        <h3 className="text-base font-extrabold text-slate-900">
                          {item.title || "حسبة محفوظة"}
                        </h3>
                        <p className="inline-flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(item.created_at)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        title="حذف الحسبة"
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/70 text-xs">
                      <div className="bg-white rounded-xl p-2.5 border border-slate-100">
                        <span className="text-slate-400 block">معاك</span>
                        <span className="font-extrabold text-emerald-700 mt-0.5 block">
                          {formatMoney(item.has_amount)}
                        </span>
                      </div>

                      <div className="bg-white rounded-xl p-2.5 border border-slate-100">
                        <span className="text-slate-400 block">عليك</span>
                        <span className="font-extrabold text-rose-700 mt-0.5 block">
                          {formatMoney(item.owed_amount)}
                        </span>
                      </div>

                      <div
                        className={`rounded-xl p-2.5 border ${
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
