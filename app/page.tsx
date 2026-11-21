"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Store,
  ArrowDownLeft,
  ArrowUpRight,
  Trash2,
  RefreshCw,
  BarChart3,
  Download,
  Search,
  Pencil,
  Banknote,
  Smartphone,
} from "lucide-react";

type ChannelType = "cash" | "vodafone";

type Transaction = {
  id: number;
  type: "income" | "expense";
  amount: number;
  account: ChannelType;
  description: string;
  date: string;
};

export default function ShopFlowPage() {
  const [shopBalance, setShopBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState("0");
  const [savingBalance, setSavingBalance] = useState(false);

  const [type, setType] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("");
  const [channel, setChannel] = useState<ChannelType>("cash");
  const [description, setDescription] = useState("");

  const [period, setPeriod] = useState<"all" | "day" | "week" | "month">("day");
  const [channelFilter, setChannelFilter] = useState<"all" | ChannelType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const money = (value: number) =>
    new Intl.NumberFormat("ar-EG").format(Number(value || 0)) + " جنيه";

  const channelLabel = (ch: ChannelType) =>
    ch === "cash" ? "الدرج" : "كاش";

  const fetchData = async () => {
    setLoading(true);

    const { data: settingsData, error: settingsErr } = await supabase
      .from("store_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (settingsErr) {
      console.error("Error fetching settings:", settingsErr.message);
    }

    if (settingsData) {
      const currentShop = Number(
        settingsData.shop_balance ?? settingsData.initial_budget ?? 0
      );
      setShopBalance(currentShop);
      setBalanceInput(String(currentShop));
    }

    const { data: txData, error: txErr } = await supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: false });

    if (txErr) {
      console.error("Error fetching transactions:", txErr.message);
    }

    if (txData) {
      setTransactions(
        txData
          .filter((t) => t.type === "income" || t.type === "expense")
          .map((t) => ({
            id: Number(t.id),
            type: t.type as "income" | "expense",
            amount: Number(t.amount),
            account: (t.account === "vodafone" ? "vodafone" : "cash") as ChannelType,
            description: String(t.description || ""),
            date: String(t.date),
          }))
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    const channelSub = supabase
      .channel("shopflow-simple-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        () => fetchData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "store_settings" },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelSub);
    };
  }, []);

  const handleSaveShopBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(balanceInput);
    if (Number.isNaN(num)) {
      alert("من فضلك اكتب رقماً صحيحاً");
      return;
    }
    setShopBalance(num);
    setEditingBalance(false);
    setSavingBalance(false);
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) return;

    setSubmitting(true);

    const nextShopBalance =
      type === "income" ? shopBalance + numAmount : shopBalance - numAmount;

    const { error: txError } = await supabase.from("transactions").insert({
      type,
      amount: numAmount,
      account: channel,
      to_account: null,
      description: description.trim(),
      date: new Date().toISOString(),
    });

    if (txError) {
      alert("حصل خطأ أثناء حفظ الحركة: " + txError.message);
      setSubmitting(false);
      return;
    }

    const { error: settingsError } = await supabase
      .from("store_settings")
      .update({
        shop_balance: nextShopBalance,
        initial_budget: nextShopBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    if (settingsError) {
      alert("الحركة اتحفظت بس تحديث رصيد المحل فيه مشكلة: " + settingsError.message);
    }

    setAmount("");
    setDescription("");
    await fetchData();
    setSubmitting(false);
  };

  const handleDeleteTransaction = async (tx: Transaction) => {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف هذه العملية بقيمة ${money(tx.amount)}؟ سيتم تعديل رصيد المحل تلقائياً.`
    );
    if (!confirmed) return;

    const restoredBalance =
      tx.type === "income" ? shopBalance - tx.amount : shopBalance + tx.amount;

    const { error: delError } = await supabase
      .from("transactions")
      .delete()
      .eq("id", tx.id);

    if (delError) {
      alert("حصل خطأ أثناء حذف العملية: " + delError.message);
      return;
    }

    const { error: updError } = await supabase
      .from("store_settings")
      .update({
        shop_balance: restoredBalance,
        initial_budget: restoredBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    if (updError) {
      alert("تم حذف العملية بس تحديث الرصيد فيه مشكلة: " + updError.message);
    }

    fetchData();
  };
  const handleExportBackup = () => {
    const backupPayload = {
      exported_at: new Date().toISOString(),
      shop_balance: shopBalance,
      transactions,
    };

    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dayStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `shopflow-backup-${dayStamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const totalCashIncome = transactions
    .filter((t) => t.type === "income" && t.account === "cash")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalVodafoneIncome = transactions
    .filter((t) => t.type === "income" && t.account === "vodafone")
    .reduce((sum, t) => sum + t.amount, 0);

  const periodTx = transactions.filter((t) => {
    if (period === "all") return true;
    const d = new Date(t.date);
    if (Number.isNaN(d.getTime())) return false;

    const now = new Date(Date.now());
    if (period === "day") {
      return d.toDateString() === now.toDateString();
    }
    if (period === "week") {
      const start = new Date(now);
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      return d >= start && d <= now;
    }
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return d >= startOfMonth && d <= now;
  });

  const periodIncome = periodTx
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const periodExpense = periodTx
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const periodDiff = periodIncome - periodExpense;
  const maxFlow = Math.max(periodIncome, periodExpense, 1);
  const incomePercent = Math.min(100, Math.round((periodIncome / maxFlow) * 100));
  const expensePercent = Math.min(
    100,
    Math.round((periodExpense / maxFlow) * 100)
  );

  const visibleTransactions = transactions.filter((tx) => {
    const matchesChannel =
      channelFilter === "all" || tx.account === channelFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      tx.description.toLowerCase().includes(q) ||
      String(tx.amount).includes(q);
    return matchesChannel && matchesQuery;
  });

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 text-gray-900 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3 bg-white p-5 rounded-2xl border shadow-xs">
          <div>
            <h1 className="text-2xl font-extrabold text-[#173B35]">
              ShopFlow — رصيد المحل والحركة اليومية
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              رصيد واحد للمحل مع فلترة الدرج والكاش ومجموع الداخل لكل منهما
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportBackup}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#173B35] text-white text-sm font-semibold hover:opacity-95"
            >
              <Download className="w-4 h-4" />
              نسخة احتياطية
            </button>
            <button
              type="button"
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold hover:bg-gray-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              تحديث
            </button>
          </div>
        </header>

        <section className="bg-white p-6 rounded-2xl border border-amber-200">
          <div className="flex items-center justify-between text-amber-800 text-sm font-bold">
            <span>رصيد المحل</span>
            <Store className="w-5 h-5" />
          </div>

          {editingBalance ? (
            <form
              onSubmit={handleSaveShopBalance}
              className="mt-3 flex flex-wrap gap-2 max-w-md"
            >
              <input
                type="number"
                step="0.01"
                autoFocus
                value={balanceInput}
                onChange={(e) => setBalanceInput(e.target.value)}
                className="flex-1 min-w-[150px] border rounded-xl px-3 py-2 text-base font-bold text-gray-900"
              />
              <button
                type="submit"
                disabled={savingBalance}
                className="bg-[#173B35] text-white px-4 py-2 rounded-xl text-sm font-bold"
              >
                {savingBalance ? "جاري الحفظ..." : "حفظ"}
              </button>
              <button
                type="button"
                onClick={() => setEditingBalance(false)}
                className="border px-3 py-2 rounded-xl text-sm font-semibold text-gray-600"
              >
                إلغاء
              </button>
            </form>
          ) : (
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-3xl font-extrabold text-gray-900">
                {money(shopBalance)}
              </p>
              <button
                type="button"
                onClick={() => {
                  setBalanceInput(String(shopBalance));
                  setEditingBalance(true);
                }}
                className="flex items-center gap-1.5 text-xs text-[#173B35] bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-xl font-bold"
              >
                <Pencil className="w-3.5 h-3.5" />
                تعديل الرصيد
              </button>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white p-5 rounded-2xl border">
            <h2 className="text-lg font-bold mb-4">تسجيل حركة جديدة</h2>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType("income")}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold border ${
                    type === "income"
                      ? "bg-green-700 text-white border-green-700"
                      : "bg-white text-gray-700"
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  داخل (+)
                </button>

                <button
                  type="button"
                  onClick={() => setType("expense")}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold border ${
                    type === "expense"
                      ? "bg-red-700 text-white border-red-700"
                      : "bg-white text-gray-700"
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  طالع (-)
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    المبلغ (جنيه)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="مثال: 500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    النوع / المكان
                  </label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as ChannelType)}
                    className="w-full border rounded-xl px-3 py-2 text-sm bg-white"
                  >
                    <option value="cash">الدرج</option>
                    <option value="vodafone">كاش</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  ملاحظة / بيان (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="مثال: مبيعات، شراء بضاعة..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#173B35] text-white py-2.5 rounded-xl font-bold text-sm hover:opacity-95 disabled:opacity-50"
              >
                {submitting ? "جاري الحفظ..." : "حفظ الحركة"}
              </button>
            </form>
          </section>
           <section className="bg-white p-5 rounded-2xl border flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold">تحليل الداخل والطالع</h2>
                <BarChart3 className="w-5 h-5 text-[#173B35]" />
              </div>
              <p className="text-xs text-gray-500 mb-4">
                متابعة الداخل والطالع والفرق (زيادة أو نقص) حسب الفترة
              </p>

              <div className="grid grid-cols-4 gap-2 mb-5">
                {[
                  { key: "day", label: "اليوم" },
                  { key: "week", label: "الأسبوع" },
                  { key: "month", label: "الشهر" },
                  { key: "all", label: "الكل" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      setPeriod(item.key as "all" | "day" | "week" | "month")
                    }
                    className={`py-2 rounded-xl text-xs font-bold border ${
                      period === item.key
                        ? "bg-[#173B35] text-white border-[#173B35]"
                        : "bg-white text-gray-700"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                <div className="bg-green-50 p-4 rounded-xl">
                  <p className="text-xs text-gray-600">الداخل (+)</p>
                  <p className="text-base font-extrabold text-green-700 mt-1">
                    {money(periodIncome)}
                  </p>
                </div>

                <div className="bg-red-50 p-4 rounded-xl">
                  <p className="text-xs text-gray-600">الطالع (-)</p>
                  <p className="text-base font-extrabold text-red-700 mt-1">
                    {money(periodExpense)}
                  </p>
                </div>

                <div className="bg-gray-100 p-4 rounded-xl">
                  <p className="text-xs text-gray-600">
                    {periodDiff > 0
                      ? "زيادة (+)"
                      : periodDiff < 0
                      ? "نقص (-)"
                      : "متعادل"}
                  </p>
                  <p
                    className={`text-base font-extrabold mt-1 ${
                      periodDiff >= 0 ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {periodDiff > 0 ? "+" : ""}
                    {money(periodDiff)}
                  </p>
                </div>
              </div>

              <div className="space-y-3 bg-gray-50 p-4 rounded-xl border">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-green-700">الداخل</span>
                    <span>{money(periodIncome)}</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-600 transition-all"
                      style={{ width: `${incomePercent}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-red-700">الطالع</span>
                    <span>{money(periodExpense)}</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-600 transition-all"
                      style={{ width: `${expensePercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400 mt-4">
              عدد العمليات في الفترة: {periodTx.length}
            </p>
          </section>
        </div>

        <section className="bg-white p-5 rounded-2xl border space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">حركات الدرج والكاش</h2>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setChannelFilter("all")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border ${
                  channelFilter === "all"
                    ? "bg-[#173B35] text-white border-[#173B35]"
                    : "bg-white text-gray-700"
                }`}
              >
                الكل
              </button>

              <button
                type="button"
                onClick={() => setChannelFilter("cash")}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border ${
                  channelFilter === "cash"
                    ? "bg-emerald-700 text-white border-emerald-700"
                    : "bg-white text-gray-700"
                }`}
              >
                <Banknote className="w-4 h-4" />
                حركات الدرج
              </button>

              <button
                type="button"
                onClick={() => setChannelFilter("vodafone")}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border ${
                  channelFilter === "vodafone"
                    ? "bg-rose-700 text-white border-rose-700"
                    : "bg-white text-gray-700"
                }`}
              >
                <Smartphone className="w-4 h-4" />
                حركات الكاش
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-4 rounded-xl border">
            <div className="bg-white p-3.5 rounded-xl border border-emerald-100">
              <p className="text-xs font-semibold text-gray-500">
                مجموع اللي دخل في الدرج (+)
              </p>
              <p className="text-lg font-extrabold text-emerald-700 mt-1">
                {money(totalCashIncome)}
              </p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-rose-100">
              <p className="text-xs font-semibold text-gray-500">
                مجموع اللي دخل في الكاش (+)
              </p>
              <p className="text-lg font-extrabold text-rose-700 mt-1">
                {money(totalVodafoneIncome)}
              </p>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ابحث بملاحظة أو بمبلغ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border rounded-xl pr-9 pl-3 py-2 text-sm"
            />
          </div>
          {visibleTransactions.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">
              لا توجد حركات مطابقة للفلترة الحالية.
            </p>
          ) : (
            <div className="divide-y">
              {visibleTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          tx.type === "income"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {tx.type === "income" ? "داخل" : "طالع"}
                      </span>

                      <span className="text-xs text-gray-700 font-bold">
                        {channelLabel(tx.account)}
                      </span>

                      <span className="text-xs text-gray-400">
                        {new Date(tx.date).toLocaleString("ar-EG")}
                      </span>
                    </div>

                    {tx.description && (
                      <p className="text-sm text-gray-700 mt-1">
                        {tx.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-sm font-extrabold ${
                        tx.type === "income" ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {tx.type === "income" ? "+" : "-"}
                      {money(tx.amount)}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDeleteTransaction(tx)}
                      title="حذف العملية"
                      className="text-gray-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
