import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import KatokLogo from "../components/KatokLogo";
import ResidentHotbar from "../components/ResidentHotbar";

const WASTE_BINS = [
  {
    id: "biodegradable",
    title: "Biodegradable (Malata)",
    binColorLabel: "Green Bin / Liner",
    accent: "#2E7D32",
    bg: "#E8F8EE",
    border: "#C5E6CE",
    icon: "leaf",
    scheduleRule: "Collected on Scheduled Biodegradable Runs",
    description:
      "Organic waste that naturally decomposes and can be processed into compost at Barangay Materials Recovery Facilities (MRFs).",
    examples: [
      "Fruit & vegetable peelings",
      "Leftover food (drained of soup/oil)",
      "Fish, meat, and poultry trimmings",
      "Dry leaves, twigs, and garden clippings",
      "Eggshells and coffee grounds",
    ],
    avoid: "Do not mix plastic wrappers, foil, or liquid cooking oil.",
  },
  {
    id: "recyclable",
    title: "Recyclable (Mapuslan Pa)",
    binColorLabel: "Blue Bin / Liner",
    accent: "#1565C0",
    bg: "#E3F2FD",
    border: "#BBDEFB",
    icon: "recycle",
    scheduleRule: "Clean, Dry & Sorted for MRF / Junkshop Recovery",
    description:
      "Clean and dry recoverable materials that can be diverted from sanitary landfills and recycled into new products.",
    examples: [
      "PET plastic bottles & rigid containers",
      "Clean cardboard, newspapers, and office paper",
      "Tin cans and aluminum beverage cans",
      "Unbroken glass bottles and jars",
      "Clean dry detergent & shampoo bottles",
    ],
    avoid: "Rinse food residue before placing in the recyclable container.",
  },
  {
    id: "residual",
    title: "Residual Waste (Di-Malata)",
    binColorLabel: "Black Bin / Liner",
    accent: "#37474F",
    bg: "#ECEFF1",
    border: "#CFD8DC",
    icon: "trash-can-outline",
    scheduleRule: "Collected by Assigned Barangay Compactor Truck",
    description:
      "Non-compostable and non-recyclable sanitary waste transported to the Cagayan de Oro Sanitary Landfill.",
    examples: [
      "Single-use sachets and laminated wrappers",
      "Soiled paper towels, tissues, and napkins",
      "Sanitary napkins and disposable diapers",
      "Worn-out rags, sponges, and styrofoam",
      "Broken ceramics and sweepings",
    ],
    avoid: "Tie bags securely to prevent street litter and stray animal spills.",
  },
  {
    id: "special",
    title: "Special & Household Hazardous",
    binColorLabel: "Red / Labeled Container",
    accent: "#C62828",
    bg: "#FFEBEE",
    border: "#FFCDD2",
    icon: "Biohazard",
    iconFallback: "alert-octagon-outline",
    scheduleRule: "Separate Handling — Never Mix with Regular Household Trash",
    description:
      "Toxic, electronic, or sharp household materials requiring dedicated CLENRO collection or hazardous drop-off.",
    examples: [
      "Used batteries, power banks, and e-waste",
      "Fluorescent bulbs and broken glass (wrapped)",
      "Paint cans, thinners, and pesticide bottles",
      "Expired medicines and household sharps",
      "Used motor oil and chemical containers",
    ],
    avoid: "Wrap sharp objects in thick cardboard and label clearly.",
  },
];

const QUICK_LOOKUP_ITEMS = [
  { item: "Banana peel & vegetable scraps", bin: "Biodegradable (Malata)", color: "#2E7D32", bg: "#E8F8EE" },
  { item: "Plastic water bottle (rinsed)", bin: "Recyclable (Mapuslan Pa)", color: "#1565C0", bg: "#E3F2FD" },
  { item: "Shampoo / coffee sachets", bin: "Residual Waste (Di-Malata)", color: "#37474F", bg: "#ECEFF1" },
  { item: "Cardboard delivery boxes", bin: "Recyclable (Mapuslan Pa)", color: "#1565C0", bg: "#E3F2FD" },
  { item: "Leftover rice & fish bones", bin: "Biodegradable (Malata)", color: "#2E7D32", bg: "#E8F8EE" },
  { item: "Disposable diapers & wet wipes", bin: "Residual Waste (Di-Malata)", color: "#37474F", bg: "#ECEFF1" },
  { item: "Broken fluorescent bulb / batteries", bin: "Special & Hazardous", color: "#C62828", bg: "#FFEBEE" },
  { item: "Tin cans & soda cans", bin: "Recyclable (Mapuslan Pa)", color: "#1565C0", bg: "#E3F2FD" },
  { item: "Dried yard leaves & twigs", bin: "Biodegradable (Malata)", color: "#2E7D32", bg: "#E8F8EE" },
  { item: "Expired medicine blisters", bin: "Special & Hazardous", color: "#C62828", bg: "#FFEBEE" },
];

const CDO_ORDINANCES = [
  {
    code: "RA 9003 & CDO Ordinance No. 13378-2018",
    title: "Mandatory Segregation at Source",
    detail:
      "All households across Urban Pilot Barangays 1–40 must segregate solid waste into Biodegradable, Recyclable, Residual, and Special containers prior to curb collection.",
    icon: "check-decagram-outline",
  },
  {
    code: "CLENRO Policy — No Segregation, No Collection",
    title: "Strict Compactor Collection Compliance",
    detail:
      "Mixed or unsegregated garbage bags will not be loaded by municipal collection crews. Place properly tied bins at your designated pickup point 30 minutes before the scheduled window.",
    icon: "truck-check-outline",
  },
  {
    code: "Integrated Plastic Regulation Ordinance",
    title: "Single-Use Plastic Reduction & Proper Disposal",
    detail:
      "Use eco-bags when shopping at Cogon and Carmen Public Markets. Keep clean plastic containers dry for barangay MRF recovery.",
    icon: "shopping-outline",
  },
  {
    code: "Anti-Littering & Anti-Illegal Dumping",
    title: "Prohibition of Open Burning & Street Dumping",
    detail:
      "Dumping waste along sidewalks, creeks, or outside scheduled hours is subject to citation fines and community service. Report violations via the KatokKalinis Report module.",
    icon: "shield-alert-outline",
  },
];

export default function ComplianceScreen() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchText, setSearchText] = useState("");

  const visibleBins = useMemo(() => {
    return WASTE_BINS.filter((bin) => {
      if (selectedCategory !== "all" && bin.id !== selectedCategory) {
        return false;
      }
      if (!searchText.trim()) return true;
      const q = searchText.toLowerCase();
      return (
        bin.title.toLowerCase().includes(q) ||
        bin.description.toLowerCase().includes(q) ||
        bin.examples.some((ex) => ex.toLowerCase().includes(q))
      );
    });
  }, [selectedCategory, searchText]);

  const matchedLookup = useMemo(() => {
    if (!searchText.trim()) return QUICK_LOOKUP_ITEMS.slice(0, 5);
    const q = searchText.toLowerCase();
    return QUICK_LOOKUP_ITEMS.filter(
      (entry) =>
        entry.item.toLowerCase().includes(q) || entry.bin.toLowerCase().includes(q)
    );
  }, [searchText]);

  const handleSelectFilter = (catId) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedCategory(catId);
  };

  return (
    <View style={styles.container}>
      {/* 1. TOP HEADER */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push("/dashboard")}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#1E331B" />
          </TouchableOpacity>
          <KatokLogo variant="header" showTagline={false} />
        </View>

        <View style={styles.headerBadge}>
          <MaterialCommunityIcons name="leaf-circle-outline" size={15} color="#2E7D32" />
          <Text style={styles.headerBadgeText}>RA 9003</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. HERO BANNER */}
        <View style={styles.heroCard}>
          <View style={styles.heroBadgeRow}>
            <View style={styles.clenroPill}>
              <MaterialCommunityIcons name="shield-check" size={13} color="#FFFFFF" />
              <Text style={styles.clenroPillText}>CLENRO CAGAYAN DE ORO</Text>
            </View>
            <Text style={styles.pilotScopeTag}>Barangays 1–40</Text>
          </View>

          <Text style={styles.heroTitle}>
            Compliance & Waste Segregation Guide
          </Text>
          <Text style={styles.heroSubtitle}>
            Follow Cagayan de Oro&apos;s &quot;No Segregation, No Collection&quot; policy to ensure timely household pickup and avoid sanitation violations.
          </Text>

          <View style={styles.heroActionsRow}>
            <TouchableOpacity
              style={styles.heroPrimaryBtn}
              activeOpacity={0.85}
              onPress={() => router.push("/schedule")}
            >
              <MaterialCommunityIcons name="calendar-clock" size={16} color="#FFFFFF" />
              <Text style={styles.heroPrimaryBtnText}>Check Schedule</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.heroSecondaryBtn}
              activeOpacity={0.85}
              onPress={() => router.push("/post")}
            >
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#2E7D32" />
              <Text style={styles.heroSecondaryBtnText}>Report Violation</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. ITEM SORTER SEARCH BAR */}
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color="#688264" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search waste item (e.g. bottle, peel, diaper, battery)..."
            placeholderTextColor="#9AA998"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#9AA998" />
            </TouchableOpacity>
          )}
        </View>

        {/* 4. QUICK WASTE ITEM BIN SORTER */}
        <View style={styles.lookupCard}>
          <View style={styles.sectionHeaderInline}>
            <MaterialCommunityIcons name="trash-can-outline" size={17} color="#2E7D32" />
            <Text style={styles.lookupCardTitle}>
              {searchText.trim() ? "Matching Bin Guide" : "Quick Household Waste Sorter"}
            </Text>
          </View>
          {matchedLookup.length === 0 ? (
            <Text style={styles.noMatchText}>
              No exact quick-lookup item matched &quot;{searchText}&quot;. Check the 4 segregation categories below.
            </Text>
          ) : (
            matchedLookup.map((row, idx) => (
              <View
                key={`${row.item}-${idx}`}
                style={[
                  styles.lookupRow,
                  idx === matchedLookup.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <Text style={styles.lookupItemText}>{row.item}</Text>
                <View style={[styles.lookupBinPill, { backgroundColor: row.bg }]}>
                  <Text style={[styles.lookupBinPillText, { color: row.color }]}>
                    {row.bin}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* 5. CATEGORY FILTER PILLS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {[
            { id: "all", label: "All 4 Bins" },
            { id: "biodegradable", label: "Biodegradable" },
            { id: "recyclable", label: "Recyclable" },
            { id: "residual", label: "Residual" },
            { id: "special", label: "Special / Hazardous" },
          ].map((tab) => {
            const active = selectedCategory === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => handleSelectFilter(tab.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 6. 4-BIN SEGREGATION CARDS */}
        <Text style={styles.sectionTitle}>Official 4-Bin Segregation Standards</Text>
        <View style={styles.binsList}>
          {visibleBins.map((bin) => (
            <View
              key={bin.id}
              style={[styles.binCard, { borderColor: bin.border }]}
            >
              <View style={styles.binCardHeader}>
                <View style={[styles.binIconCircle, { backgroundColor: bin.bg }]}>
                  <MaterialCommunityIcons
                    name={bin.iconFallback || bin.icon}
                    size={24}
                    color={bin.accent}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.binTitleRow}>
                    <Text style={styles.binTitle}>{bin.title}</Text>
                  </View>
                  <View style={[styles.binColorBadge, { backgroundColor: bin.bg }]}>
                    <Text style={[styles.binColorBadgeText, { color: bin.accent }]}>
                      {bin.binColorLabel}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.binDescription}>{bin.description}</Text>

              <View style={styles.examplesBox}>
                <Text style={styles.examplesHeading}>Accepted Items:</Text>
                {bin.examples.map((ex, i) => (
                  <View key={`${bin.id}-ex-${i}`} style={styles.exampleItemRow}>
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={14}
                      color={bin.accent}
                    />
                    <Text style={styles.exampleItemText}>{ex}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.avoidRow}>
                <MaterialCommunityIcons
                  name="information-outline"
                  size={15}
                  color="#B45309"
                />
                <Text style={styles.avoidText}>{bin.avoid}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* 7. CDO SANITATION ORDINANCES & COMPLIANCE RULES */}
        <Text style={[styles.sectionTitle, { marginTop: 18 }]}>
          City Sanitation Ordinances & Rules
        </Text>
        <View style={styles.ordinancesList}>
          {CDO_ORDINANCES.map((ord, idx) => (
            <View key={`ord-${idx}`} style={styles.ordinanceCard}>
              <View style={styles.ordinanceIconWrap}>
                <MaterialCommunityIcons name={ord.icon} size={20} color="#2E7D32" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ordinanceCode}>{ord.code}</Text>
                <Text style={styles.ordinanceTitle}>{ord.title}</Text>
                <Text style={styles.ordinanceDetail}>{ord.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* 8. 4-TAB RESIDENT BOTTOM HOTBAR */}
      <ResidentHotbar activeTab="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBFDFB",
    paddingTop: 45,
  },
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF5ED",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F2F7F1",
    justifyContent: "center",
    alignItems: "center",
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E8F8EE",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#C5E6CE",
  },
  headerBadgeText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#2E7D32",
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 95,
  },
  heroCard: {
    backgroundColor: "#EAF6E9",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: "#CBE7C9",
    marginBottom: 14,
  },
  heroBadgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  clenroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#2E7D32",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  clenroPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  pilotScopeTag: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1E5822",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#1E331B",
    marginBottom: 5,
  },
  heroSubtitle: {
    fontSize: 12.5,
    color: "#3F5E3B",
    lineHeight: 18,
    fontWeight: "500",
  },
  heroActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  heroPrimaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#2E7D32",
    paddingVertical: 10,
    borderRadius: 12,
  },
  heroPrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "800",
  },
  heroSecondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#B7DFB9",
  },
  heroSecondaryBtnText: {
    color: "#2E7D32",
    fontSize: 12.5,
    fontWeight: "800",
  },
  searchBar: {
    height: 46,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderWidth: 1.2,
    borderColor: "#DDEADA",
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: "#1E331B",
  },
  lookupCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E4EFE3",
    marginBottom: 14,
  },
  sectionHeaderInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  lookupCardTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#1E331B",
  },
  noMatchText: {
    fontSize: 12,
    color: "#688264",
    paddingVertical: 4,
  },
  lookupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F7F1",
    gap: 8,
  },
  lookupItemText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "600",
    color: "#2C3E2A",
  },
  lookupBinPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  lookupBinPillText: {
    fontSize: 10.5,
    fontWeight: "800",
  },
  filterRow: {
    gap: 8,
    paddingBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E6D6",
  },
  filterChipActive: {
    backgroundColor: "#2E7D32",
    borderColor: "#2E7D32",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4A6B46",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1E331B",
    marginBottom: 10,
  },
  binsList: {
    gap: 12,
  },
  binCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 15,
    borderWidth: 1.3,
  },
  binCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  binIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  binTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  binTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#1E331B",
  },
  binColorBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    marginTop: 4,
  },
  binColorBadgeText: {
    fontSize: 10.5,
    fontWeight: "800",
  },
  binDescription: {
    fontSize: 12.5,
    color: "#4B6348",
    lineHeight: 17.5,
    marginBottom: 10,
  },
  examplesBox: {
    backgroundColor: "#F8FBF7",
    borderRadius: 12,
    padding: 11,
    borderWidth: 1,
    borderColor: "#EAF2E9",
    gap: 5,
  },
  examplesHeading: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#2E472C",
    marginBottom: 2,
  },
  exampleItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  exampleItemText: {
    fontSize: 12,
    color: "#2F3E2E",
    fontWeight: "600",
    flex: 1,
  },
  avoidRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 9,
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  avoidText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#92400E",
    flex: 1,
  },
  ordinancesList: {
    gap: 10,
  },
  ordinanceCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5EFE4",
    gap: 12,
  },
  ordinanceIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#E8F8EE",
    justifyContent: "center",
    alignItems: "center",
  },
  ordinanceCode: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#2E7D32",
    textTransform: "uppercase",
  },
  ordinanceTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E331B",
    marginTop: 2,
  },
  ordinanceDetail: {
    fontSize: 12,
    color: "#526A4F",
    lineHeight: 17,
    marginTop: 3,
  },
});

