import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export interface BarangayItem {
  id: number;
  name: string;
}

// Pre-populated standard Barangays 1 through 40 (Cagayan de Oro City)
export const BARANGAYS_1_TO_40: BarangayItem[] = Array.from({ length: 40 }, (_, i) => ({
  id: i + 1,
  name: `Barangay ${i + 1}`,
}));

interface BarangayPickerModalProps {
  selectedBarangay: string | BarangayItem | null | undefined;
  onSelect: (barangay: BarangayItem) => void;
  label?: string;
  placeholder?: string;
  error?: string | null;
  disabled?: boolean;
}

export default function BarangayPickerModal({
  selectedBarangay,
  onSelect,
  placeholder = "Select Barangay",
  error,
  disabled = false,
}: BarangayPickerModalProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedBarangayLabel = useMemo(() => {
    if (!selectedBarangay) return "";
    if (typeof selectedBarangay === "string") return selectedBarangay;
    if (typeof selectedBarangay === "object" && selectedBarangay.name) {
      return String(selectedBarangay.name);
    }
    return "";
  }, [selectedBarangay]);

  const filteredBarangays = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return BARANGAYS_1_TO_40;
    return BARANGAYS_1_TO_40.filter((b) =>
      b.name.toLowerCase().includes(query) || String(b.id) === query
    );
  }, [searchQuery]);

  const handleSelect = (item: BarangayItem) => {
    onSelect(item);
    setModalVisible(false);
    setSearchQuery("");
  };

  return (
    <View style={styles.wrapper}>
      {/* Trigger Button */}
      <TouchableOpacity
        style={[
          styles.triggerBox,
          error ? styles.triggerError : null,
          modalVisible ? styles.triggerActive : null,
          disabled ? styles.triggerDisabled : null,
        ]}
        activeOpacity={0.8}
        onPress={() => !disabled && setModalVisible(true)}
      >
        <View style={styles.triggerLeft}>
          <MaterialCommunityIcons
            name="map-marker-outline"
            size={20}
            color={selectedBarangayLabel ? "#2E7D32" : "#7A8D78"}
            style={styles.triggerIcon}
          />
          <Text
            style={[
              styles.triggerText,
              !selectedBarangayLabel && styles.triggerPlaceholder,
            ]}
            numberOfLines={1}
          >
            {selectedBarangayLabel || placeholder}
          </Text>
        </View>

        <MaterialCommunityIcons
          name="chevron-down"
          size={20}
          color="#7A8D78"
        />
      </TouchableOpacity>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Modal Selection Dialog */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalDragHandle} />
              <View style={styles.modalTitleRow}>
                <View style={styles.modalTitleIconBox}>
                  <MaterialCommunityIcons name="map-marker" size={20} color="#2E7D32" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Select Barangay</Text>
                  <Text style={styles.modalSubtitle}>Barangay 1 to Barangay 40</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setModalVisible(false)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <MaterialCommunityIcons name="close" size={20} color="#5C7558" />
                </TouchableOpacity>
              </View>

              {/* Search Bar */}
              <View style={styles.searchBar}>
                <MaterialCommunityIcons name="magnify" size={20} color="#7A8D78" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search Barangay (e.g. 12, Barangay 33)..."
                  placeholderTextColor="#9AA998"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setSearchQuery("")}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons name="close-circle" size={18} color="#9AA998" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* List of Barangays */}
            <FlatList
              data={filteredBarangays}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isSelected =
                  selectedBarangayLabel === item.name ||
                  selectedBarangayLabel === `Barangay ${item.id}` ||
                  selectedBarangayLabel === String(item.id);

                return (
                  <TouchableOpacity
                    style={[
                      styles.itemRow,
                      isSelected && styles.itemRowSelected,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => handleSelect(item)}
                  >
                    <View style={styles.itemLeft}>
                      <View
                        style={[
                          styles.itemBadge,
                          isSelected && styles.itemBadgeSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.itemBadgeText,
                            isSelected && styles.itemBadgeTextSelected,
                          ]}
                        >
                          {item.id}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.itemName,
                          isSelected && styles.itemNameSelected,
                        ]}
                      >
                        {item.name}
                      </Text>
                    </View>

                    {isSelected ? (
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={22}
                        color="#2E7D32"
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={18}
                        color="#C0D4BF"
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons
                    name="map-marker-off-outline"
                    size={36}
                    color="#A8BCA6"
                  />
                  <Text style={styles.emptyTitle}>No Barangay Found</Text>
                  <Text style={styles.emptySubtitle}>
                    Try typing a number between 1 and 40
                  </Text>
                </View>
              }
            />
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },
  triggerBox: {
    height: 52,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderWidth: 1.2,
    borderColor: "#D6E4D4",
  },
  triggerError: {
    borderColor: "#D32F2F",
    backgroundColor: "#FFF8F8",
  },
  triggerActive: {
    borderColor: "#2E7D32",
  },
  triggerDisabled: {
    opacity: 0.6,
    backgroundColor: "#F6FBF5",
  },
  triggerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  triggerIcon: {
    marginRight: 10,
  },
  triggerText: {
    fontSize: 14,
    color: "#1E331B",
    fontWeight: "500",
    flex: 1,
  },
  triggerPlaceholder: {
    color: "#9AA998",
    fontWeight: "400",
  },
  errorText: {
    color: "#D32F2F",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 4,
    marginLeft: 6,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(18, 38, 16, 0.45)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "82%",
    paddingBottom: Platform.OS === "ios" ? 20 : 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF5ED",
  },
  modalDragHandle: {
    width: 38,
    height: 4,
    backgroundColor: "#D6E4D4",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  modalTitleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E8F8EE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1E331B",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#688264",
    marginTop: 1,
  },
  closeButton: {
    marginLeft: "auto",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F2F6F1",
    justifyContent: "center",
    alignItems: "center",
  },
  searchBar: {
    height: 44,
    backgroundColor: "#F4FAF2",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#DFEEDB",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1E331B",
    marginLeft: 8,
    paddingVertical: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginVertical: 2,
    backgroundColor: "#FFFFFF",
  },
  itemRowSelected: {
    backgroundColor: "#E8F8EE",
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F0F5EF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  itemBadgeSelected: {
    backgroundColor: "#2E7D32",
  },
  itemBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5C7558",
  },
  itemBadgeTextSelected: {
    color: "#FFFFFF",
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2C3E2A",
  },
  itemNameSelected: {
    color: "#1E5822",
    fontWeight: "800",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#4A6348",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#839E81",
    marginTop: 4,
  },
});
