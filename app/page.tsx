"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Trash2,
  RefreshCw,
  Banknote,
  Smartphone,
  BarChart3,
  Download,
  Search,
} from "lucide-react";

type StoreSettings = {
  id: number;
  initial_budget: number;
  cash_balance: number;
  vodafone_balance: number;
};

type Transaction = {
  id: number;
  type: "income" | "expense" | "transfer";
  amount: number;
  account: "cash" | "vodafone";
  to_account: "cash" | "vodafone" | null;
  description: string;
  date: string;
};

export default function ShopFlowPage() {
  const [settings, setSettings] = useState<StoreSettings>({
    id: 1,
    initial_budget: 100000,
    cash_balance: 100000,
    vodafone_balance: 0,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // نموذج إضافة حركة
  const [type, setType] = useState<"income" | "expense" | "transfer">("income");
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState<"cash" | "vodafone">("cash");
  const [toAccount, setToAccount] = useState<"cash" | "vodafone">("vodafone");
  const [description, setDescription] = useState("");

  // تعديل الميزانية الافتتاحية
  const [budgetInput, setBudgetInput] = useState("100000");
  const [editingBudget, setEditingBudget] = useState(false);

  // فلتر التقارير وتحليل البيانات
  const [period, setPeriod] = useState<"all" | "day" | "week" | "month">("day");

  // فلترة وبحث سجل الحركات
  const [txTypeFilter, setTxTypeFilter] = useState<
    "all" | "income" | "expense" | "transfer"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  const money = (value: number) =>
    new Intl.NumberFormat("ar-EG").format(Number(value || 0)) + " جنيه";

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
      setSettings({
        id: settingsData.id,
        initial_budget: Number(settingsData.initial_budget),
        cash_balance: Number(settingsData.cash_balance),
        vodafone_balance: Number(settingsData.vodafone_balance),
      });
      setBudgetInput(String(settingsData.initial_budget));
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
        txData.map((t) => ({
          ...t,
          amount: Number(t.amount),
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel("shopflow-realtime")
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
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const numBudget = Number(budgetInput);
    if (Number.isNaN(numBudget) || numBudget < 0) return;

    const { error } = await supabase
      .from("store_settings")
      .update({
        initial_budget: numBudget,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    if (error) {
      alert("حصل خطأ أثناء حفظ الميزانية: " + error.message);
      return;
    }

    setEditingBudget(false);
    fetchData();
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) return;

    if (type === "transfer" && account === toAccount) {
      alert("اختر حسابين مختلفين للتحويل");
      return;
    }

    setSubmitting(true);

    let newCash = settings.cash_balance;
    let newVodafone = settings.vodafone_balance;

    if (type === "income") {
      if (account === "cash") newCash += numAmount;
      else newVodafone += numAmount;
    } else if (type === "expense") {
      if (account === "cash") newCash -= numAmount;
      else newVodafone -= numAmount;
    } else if (type === "transfer") {
      if (account === "cash") {
        newCash -= numAmount;
        newVodafone += numAmount;
      } else {
        newVodafone -= numAmount;
        newCash += numAmount;
      }
    }

    const { error: txError } = await supabase.from("transactions").insert({
      type,
      amount: numAmount,
      account,
      to_account: type === "transfer" ? toAccount : null,
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
        cash_balance: newCash,
        vodafone_balance: newVodafone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);

    if (settingsError) {
      alert("الحركة اتحفظت بس تحديث الرصيد فيه مشكلة: " + settingsError.message);
    }

    setAmount("");
    setDescription("");
    await fetchData();
    setSubmitting(false);
  };

  const handleDeleteTransaction = async (tx: Transaction) => {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف هذه العملية بقيمة ${money(tx.amount)}؟ سيتم تعديل الرصيد تلقائياً.`
    );
    if (!confirmed) return;

    let restoredCash = settings.cash_balance;
    let restoredVodafone = settings.vodafone_balance;

    if (tx.type === "income") {
      if (tx.account === "cash") restoredCash -= tx.amount;
      else restoredVodafone -= tx.amount;
    } else if (tx.type === "expense") {
      if (tx.account === "cash") restoredCash += tx.amount;
      else restoredVodafone += tx.amount;
    } else if (tx.type === "transfer" && tx.to_account) {
      if (tx.account === "cash") {
        restoredCash += tx.amount;
        restoredVodafone -= tx.amount;
      } else {
        restoredVodafone += tx.amount;
        restoredCash -= tx.amount;
      }
    }

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
        cash_balance: restoredCash,
        vodafone_balance: restoredVodafone,
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
      settings,
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

  // الإجماليات والفرق عن الميزانية
  const currentTotalBalance = settings.cash_balance + settings.vodafone_balance;
  const budgetDifference = currentTotalBalance - settings.initial_budget;

  // تصفية التقارير حسب الفترة
  const filteredTx = transactions.filter((t) => {
    if (period === "all") return true;
    const d = new Date(t.date);
    if (Number.isNaN(d.getTime())) return false;

    const currentDate = new Date(Date.now());

    if (period === "day") {
      return d.toDateString() === currentDate.toDateString();
    }
    if (period === "week") {
      const start = new Date(currentDate);
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      return d >= start && d <= currentDate;
    }
    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    return d >= startOfMonth && d <= currentDate;
  });

  const periodIncome = filteredTx
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const periodExpense = filteredTx
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const periodNet = periodIncome - periodExpense;
  const maxFlow = Math.max(periodIncome, periodExpense, 1);
  const incomePercent = Math.min(100, Math.round((periodIncome / maxFlow) * 100));
  const expensePercent = Math.min(
    100,
    Math.round((periodExpense / maxFlow) * 100)
  );

  // فلترة وبحث سجل الحركات
  const visibleTransactions = transactions.filter((tx) => {
    const matchesType = txTypeFilter === "all" || tx.type === txTypeFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      tx.description.toLowerCase().includes(q) ||
      String(tx.amount).includes(q);
    return matchesType && matchesQuery;
  });

  const accountLabel = (acc: "cash" | "vodafone" | null) => {
    if (acc === "cash") return "الدرج (كاش)";
    if (acc === "vodafone") return "فودافون كاش";
    return "";
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 text-gray-900 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* العنوان */}
        <header className="flex flex-wrap items-center justify-between gap-3 bg-white p-5 rounded-2xl border shadow-xs">
          <div>
            <h1 className="text-2xl font-extrabold text-[#173B35]">
              ShopFlow — متابعة ميزانية المحل
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              حساب الميزانية، الداخل والطالع، التحويلات، وتحليل البيانات لحظياً
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

        {/* كروت الميزانية وإجمالي الرصيد */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border">
            <div className="flex items-center justify-between text-gray-500 text-sm">
              <span>الميزانية الافتتاحية</span>
              <Wallet className="w-4 h-4 text-[#173B35]" />
            </div>
            {editingBudget ? (
              <form onSubmit={handleSaveBudget} className="mt-3 flex gap-2">
                <input
                  type="number"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  className="w-full border rounded-lg px-2 py-1 text-sm font-bold"
                />
                <button
                  type="submit"
                  className="bg-[#173B35] text-white px-3 py-1 rounded-lg text-xs font-bold"
                >
                  حفظ
                </button>
              </form>
            ) : (
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xl font-extrabold text-gray-900">
                  {money(settings.initial_budget)}
                </p>
                <button
                  onClick={() => setEditingBudget(true)}
                  className="text-xs text-[#173B35] underline font-semibold"
                >
                  تعديل
                </button>
              </div>
            )}
          </div>

          <div className="bg-white p-5 rounded-2xl border">
            <span className="text-gray-500 text-sm">إجمالي الرصيد الحالي</span>
            <p className="text-xl font-extrabold text-[#173B35] mt-2">
              {money(currentTotalBalance)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              مجموع الدرج وفودافون كاش معاً
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border">
            <span className="text-gray-500 text-sm">الفرق عن الميزانية</span>
            <p
              className={`text-xl font-extrabold mt-2 ${
                budgetDifference >= 0 ? "text-green-700" : "text-red-700"
              }`}
            >
              {budgetDifference >= 0 ? "+" : ""}
              {money(budgetDifference)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {budgetDifference > 0
                ? "الميزانية زادت عن البداية"
                : budgetDifference < 0
                ? "الميزانية أقل من البداية"
                : "مساوية للميزانية الافتتاحية"}
            </p>
          </div>
        </section>

        {/* كروت فصل الدرج (كاش) وفودافون كاش */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-emerald-200">
            <div className="flex items-center justify-between text-emerald-800 text-sm font-bold">
              <span>رصيد الدرج (كاش)</span>
              <Banknote className="w-5 h-5" />
            </div>
            <p className="text-2xl font-extrabold text-gray-900 mt-2">
              {money(settings.cash_balance)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              النقدية المتاحة داخل المحل
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-rose-200">
            <div className="flex items-center justify-between text-rose-700 text-sm font-bold">
              <span>رصيد فودافون كاش</span>
              <Smartphone className="w-5 h-5" />
            </div>
            <p className="text-2xl font-extrabold text-gray-900 mt-2">
              {money(settings.vodafone_balance)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              الرصيد المتاح على المحفظة الإلكترونية
            </p>
          </div>
        </section>

        {/* إضافة حركة جديدة + تحليل البيانات والإحصائيات */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* نموذج تسجيل حركة */}
          <section className="bg-white p-5 rounded-2xl border">
            <h2 className="text-lg font-bold mb-4">تسجيل حركة جديدة</h2>
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setType("income")}
                  className={`flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-bold border ${
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
                  className={`flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-bold border ${
                    type === "expense"
                      ? "bg-red-700 text-white border-red-700"
                      : "bg-white text-gray-700"
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  طالع (-)
                </button>

                <button
                  type="button"
                  onClick={() => setType("transfer")}
                  className={`flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-bold border ${
                    type === "transfer"
                      ? "bg-[#173B35] text-white border-[#173B35]"
                      : "bg-white text-gray-700"
                  }`}
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  تحويل
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
                    {type === "transfer" ? "من حساب" : "الحساب"}
                  </label>
                  <select
                    value={account}
                    onChange={(e) =>
                      setAccount(e.target.value as "cash" | "vodafone")
                    }
                    className="w-full border rounded-xl px-3 py-2 text-sm bg-white"
                  >
                    <option value="cash">الدرج (كاش)</option>
                    <option value="vodafone">فودافون كاش</option>
                  </select>
                </div>
              </div>

              {type === "transfer" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    إلى حساب
                  </label>
                  <select
                    value={toAccount}
                    onChange={(e) =>
                      setToAccount(e.target.value as "cash" | "vodafone")
                    }
                    className="w-full border rounded-xl px-3 py-2 text-sm bg-white"
                  >
                    <option value="vodafone">فودافون كاش</option>
                    <option value="cash">الدرج (كاش)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  ملاحظة / بيان (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="مثال: مبيعات الصباح، شراء بضاعة، تحويل..."
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

          {/* شاشة تحليل البيانات والإحصائيات (الداخل والطالع) */}
          <section className="bg-white p-5 rounded-2xl border flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold">تحليل البيانات والإحصائيات</h2>
                <BarChart3 className="w-5 h-5 text-[#173B35]" />
              </div>
              <p className="text-xs text-gray-500 mb-4">
                مقارنة الداخل والطالع والصافي خلال الفترة المحددة (التحويلات بين
                الحسابات لا تُحسب كربح أو خسارة)
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
                  <p className="text-xs text-gray-600">الداخل (المكسب/الإيراد)</p>
                  <p className="text-base font-extrabold text-green-700 mt-1">
                    {money(periodIncome)}
                  </p>
                </div>

                <div className="bg-red-50 p-4 rounded-xl">
                  <p className="text-xs text-gray-600">الطالع (المصروف/الخارج)</p>
                  <p className="text-base font-extrabold text-red-700 mt-1">
                    {money(periodExpense)}
                  </p>
                </div>

                <div className="bg-gray-100 p-4 rounded-xl">
                  <p className="text-xs text-gray-600">صافي الفترة</p>
                  <p
                    className={`text-base font-extrabold mt-1 ${
                      periodNet >= 0 ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {money(periodNet)}
                  </p>
                </div>
              </div>

              {/* مقارنة بصرية للداخل والطالع */}
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
              عدد العمليات في الفترة: {filteredTx.length}
            </p>
          </section>
        </div>

        {/* سجل العمليات مع الفلترة والبحث */}
        <section className="bg-white p-5 rounded-2xl border space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">سجل الحركات</h2>

            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: "all", label: "الكل" },
                { key: "income", label: "داخل" },
                { key: "expense", label: "طالع" },
                { key: "transfer", label: "تحويل" },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() =>
                    setTxTypeFilter(
                      f.key as "all" | "income" | "expense" | "transfer"
                    )
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                    txTypeFilter === f.key
                      ? "bg-[#173B35] text-white border-[#173B35]"
                      : "bg-white text-gray-700"
                  }`}
                >
                  {f.label}
                </button>
              ))}
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
              لا توجد عمليات مطابقة للفلترة أو البحث الحالي.
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
                            : tx.type === "expense"
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {tx.type === "income"
                          ? "داخل"
                          : tx.type === "expense"
                          ? "طالع"
                          : "تحويل"}
                      </span>

                      <span className="text-xs text-gray-600 font-semibold">
                        {tx.type === "transfer"
                          ? `${accountLabel(tx.account)} ← ${accountLabel(
                              tx.to_account
                            )}`
                          : accountLabel(tx.account)}
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
                        tx.type === "income"
                          ? "text-green-700"
                          : tx.type === "expense"
                          ? "text-red-700"
                          : "text-blue-700"
                      }`}
                    >
                      {tx.type === "income"
                        ? "+"
                        : tx.type === "expense"
                        ? "-"
                        : ""}
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