import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { firstValueFrom, Subject, switchMap, takeUntil } from "rxjs";

import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { CipherType } from "@bitwarden/common/enums/cipherType";
import { ITreeNodeObject, TreeNode } from "@bitwarden/common/models/domain/treeNode";
import { CollectionView } from "@bitwarden/common/models/view/collectionView";
import { FolderView } from "@bitwarden/common/models/view/folderView";

import { VaultFilterService } from "../services/abstractions/vault-filter.service";
import { VaultFilterList } from "../shared/models/vault-filter-section.type";
import { VaultFilter } from "../shared/models/vault-filter.model";
import {
  CipherTypeFilter,
  CollectionFilter,
  FolderFilter,
  OrganizationFilter,
} from "../shared/models/vault-filter.type";

import { OrganizationOptionsComponent } from "./organization-options.component";

@Component({
  selector: "app-vault-filter",
  templateUrl: "vault-filter.component.html",
})
export class VaultFilterComponent implements OnInit, OnDestroy {
  filters?: VaultFilterList;
  @Input() activeFilter: VaultFilter = new VaultFilter();
  @Output() activeFilterChanged = new EventEmitter<VaultFilter>();
  @Output() onSearchTextChanged = new EventEmitter<string>();
  @Output() onAddFolder = new EventEmitter<never>();
  @Output() onEditFolder = new EventEmitter<FolderView>();

  isLoaded = false;
  searchPlaceholder = "";
  searchText = "";
  collapsedFilterNodes: Set<string>;
  currentFilterCollections: CollectionView[] = [];

  protected destroy$: Subject<void> = new Subject<void>();

  get filtersList() {
    return this.filters ? Object.values(this.filters) : [];
  }

  constructor(
    protected vaultFilterService: VaultFilterService,
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService
  ) {
    this.loadSubscriptions();
  }

  async ngOnInit(): Promise<void> {
    await this.buildAllFilters();
    await this.applyTypeFilter(
      (await firstValueFrom(this.filters?.typeFilter.data$)) as TreeNode<CipherTypeFilter>
    );
    this.isLoaded = true;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected loadSubscriptions() {
    this.vaultFilterService.collapsedFilterNodes$
      .pipe(takeUntil(this.destroy$))
      .subscribe((nodes) => {
        this.collapsedFilterNodes = nodes;
      });

    this.vaultFilterService.filteredFolders$
      .pipe(
        switchMap(async (folders) => {
          this.removeInvalidFolderSelection(folders);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();

    this.vaultFilterService.filteredCollections$
      .pipe(
        switchMap(async (collections) => {
          this.currentFilterCollections = collections;
          this.removeInvalidCollectionSelection(collections);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  searchTextChanged() {
    this.onSearchTextChanged.emit(this.searchText);
  }

  async toggleFilterNodeCollapseState(node: ITreeNodeObject) {
    if (this.collapsedFilterNodes.has(node.id)) {
      this.collapsedFilterNodes.delete(node.id);
    } else {
      this.collapsedFilterNodes.add(node.id);
    }
    await this.vaultFilterService.storeCollapsedFilterNodes(this.collapsedFilterNodes);
  }

  // Remove when organizations is refactored with observables
  async reloadOrganizations() {
    if (this.filters) {
      await this.vaultFilterService.reloadOrganizations();
    }
  }

  // TODO: Remove when collections is refactored with observables
  async reloadCollections() {
    await this.vaultFilterService.reloadCollections();
  }

  protected async applyVaultFilter(filter: VaultFilter) {
    this.searchPlaceholder = this.calculateSearchBarLocalizationString(filter);
    this.activeFilterChanged.emit(filter);
  }

  applyOrganizationFilter = async (orgNode: TreeNode<OrganizationFilter>): Promise<void> => {
    if (!orgNode?.node.enabled) {
      this.platformUtilsService.showToast(
        "error",
        null,
        this.i18nService.t("disabledOrganizationFilterError")
      );
      return;
    }
    const filter = this.activeFilter;
    filter.resetOrganization();
    if (orgNode?.node.id !== "AllVaults") {
      filter.selectedOrganizationNode = orgNode;
    }
    this.vaultFilterService.updateOrganizationFilter(orgNode.node);
    await this.vaultFilterService.expandOrgFilter();
    await this.applyVaultFilter(filter);
  };

  applyTypeFilter = async (filterNode: TreeNode<CipherTypeFilter>): Promise<void> => {
    const filter = this.activeFilter;
    filter.resetFilter();
    filter.selectedCipherTypeNode = filterNode;
    await this.applyVaultFilter(filter);
  };

  applyFolderFilter = async (folderNode: TreeNode<FolderFilter>): Promise<void> => {
    const filter = this.activeFilter;
    filter.resetFilter();
    filter.selectedFolderNode = folderNode;
    await this.applyVaultFilter(filter);
  };

  applyCollectionFilter = async (collectionNode: TreeNode<CollectionFilter>): Promise<void> => {
    const filter = this.activeFilter;
    filter.resetFilter();
    filter.selectedCollectionNode = collectionNode;
    await this.applyVaultFilter(filter);
  };

  addFolder = async (): Promise<void> => {
    this.onAddFolder.emit();
  };

  editFolder = async (folder: FolderFilter): Promise<void> => {
    this.onEditFolder.emit(folder);
  };

  calculateSearchBarLocalizationString(vaultFilter: VaultFilter): string {
    if (vaultFilter.isFavorites) {
      return "searchFavorites";
    }
    if (vaultFilter.isDeleted) {
      return "searchTrash";
    }
    if (vaultFilter.cipherType === CipherType.Login) {
      return "searchLogin";
    }
    if (vaultFilter.cipherType === CipherType.Card) {
      return "searchCard";
    }
    if (vaultFilter.cipherType === CipherType.Identity) {
      return "searchIdentity";
    }
    if (vaultFilter.cipherType === CipherType.SecureNote) {
      return "searchSecureNote";
    }
    if (vaultFilter.selectedFolderNode?.node) {
      return "searchFolder";
    }
    if (vaultFilter.selectedCollectionNode?.node) {
      return "searchCollection";
    }
    if (vaultFilter.organizationId === "MyVault") {
      return "searchMyVault";
    }
    if (vaultFilter.organizationId) {
      return "searchOrganization";
    }

    return "searchVault";
  }

  protected async removeInvalidFolderSelection(folders: FolderView[]) {
    if (this.activeFilter.selectedFolderNode) {
      if (!folders.find((f) => f.id === this.activeFilter.folderId)) {
        const filter = this.activeFilter;
        filter.resetFilter();
        filter.selectedCipherTypeNode = (await firstValueFrom(
          this.filters?.typeFilter.data$
        )) as TreeNode<CipherTypeFilter>;
        await this.applyVaultFilter(filter);
      }
    }
  }

  protected async removeInvalidCollectionSelection(collections: CollectionView[]) {
    if (this.activeFilter.selectedCollectionNode) {
      if (!collections.find((f) => f.id === this.activeFilter.collectionId)) {
        const filter = this.activeFilter;
        filter.resetFilter();
        filter.selectedCipherTypeNode = (await firstValueFrom(
          this.filters?.typeFilter?.data$
        )) as TreeNode<CipherTypeFilter>;
        await this.applyVaultFilter(filter);
      }
    }
  }

  async buildAllFilters() {
    let builderFilter = {} as VaultFilterList;
    builderFilter = await this.addOrganizationFilter(builderFilter);
    builderFilter = await this.addTypeFilter(builderFilter);
    builderFilter = await this.addFolderFilter(builderFilter);
    builderFilter = await this.addCollectionFilter(builderFilter);
    builderFilter = await this.addTrashFilter(builderFilter);

    this.filters = builderFilter;
  }

  protected async addOrganizationFilter(filter: VaultFilterList) {
    const singleOrgPolicy = await this.vaultFilterService.checkForSingleOrganizationPolicy();
    const personalVaultPolicy = await this.vaultFilterService.checkForPersonalOwnershipPolicy();

    const optionsComponent = !personalVaultPolicy
      ? { component: OrganizationOptionsComponent }
      : null;
    const addAction = !singleOrgPolicy
      ? { text: "newOrganization", route: "/create-organization" }
      : null;

    filter.organizationFilter = {
      data$: this.vaultFilterService.organizationTree$,
      header: {
        showHeader: !(singleOrgPolicy && personalVaultPolicy),
        isSelectable: true,
      },
      action: this.applyOrganizationFilter,
      options: optionsComponent,
      add: addAction,
      divider: true,
    };

    return filter;
  }

  protected async addTypeFilter(filter: VaultFilterList) {
    filter.typeFilter = {
      data$: this.vaultFilterService.buildTypeTree(
        { id: "AllItems", name: "allItems", type: "all", icon: "" },
        [
          {
            id: "favorites",
            name: this.i18nService.t("favorites"),
            type: "favorites",
            icon: "bwi-star",
          },
          {
            id: "login",
            name: this.i18nService.t("typeLogin"),
            type: CipherType.Login,
            icon: "bwi-globe",
          },
          {
            id: "card",
            name: this.i18nService.t("typeCard"),
            type: CipherType.Card,
            icon: "bwi-credit-card",
          },
          {
            id: "identity",
            name: this.i18nService.t("typeIdentity"),
            type: CipherType.Identity,
            icon: "bwi-id-card",
          },
          {
            id: "note",
            name: this.i18nService.t("typeSecureNote"),
            type: CipherType.SecureNote,
            icon: "bwi-sticky-note",
          },
        ]
      ),
      header: {
        showHeader: true,
        isSelectable: true,
      },
      action: this.applyTypeFilter,
    };
    return filter;
  }

  protected async addFolderFilter(filter: VaultFilterList) {
    filter.folderFilter = {
      data$: this.vaultFilterService.folderTree$,
      header: {
        showHeader: true,
        isSelectable: false,
      },
      action: this.applyFolderFilter,
      edit: {
        text: "editFolder",
        action: this.editFolder,
      },
      add: {
        text: "Add Folder",
        action: this.addFolder,
      },
    };
    return filter;
  }

  protected async addCollectionFilter(filter: VaultFilterList) {
    filter.collectionFilter = {
      data$: this.vaultFilterService.collectionTree$,
      header: {
        showHeader: true,
        isSelectable: true,
      },
      action: this.applyCollectionFilter,
    };
    return filter;
  }

  protected async addTrashFilter(filter: VaultFilterList) {
    filter.trashFilter = {
      data$: this.vaultFilterService.buildTypeTree(
        {
          id: "headTrash",
          name: "HeadTrash",
          type: "trash",
          icon: "bwi-trash",
        },
        [
          {
            id: "trash",
            name: this.i18nService.t("trash"),
            type: "trash",
            icon: "bwi-trash",
          },
        ]
      ),
      header: {
        showHeader: false,
        isSelectable: true,
      },
      action: this.applyTypeFilter,
    };
    return filter;
  }
}