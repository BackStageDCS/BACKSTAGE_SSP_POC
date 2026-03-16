/*
 * Copyright 2020 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  RELATION_API_CONSUMED_BY,
  RELATION_API_PROVIDED_BY,
  RELATION_CONSUMES_API,
  RELATION_DEPENDENCY_OF,
  RELATION_DEPENDS_ON,
  RELATION_HAS_PART,
  RELATION_PART_OF,
  RELATION_PROVIDES_API,
} from '@backstage/catalog-model';
import { EmptyState } from '@backstage/core-components';
import {
  EntityApiDefinitionCard,
  EntityConsumedApisCard,
  EntityConsumingComponentsCard,
  EntityHasApisCard,
  EntityProvidedApisCard,
  EntityProvidingComponentsCard,
} from '@backstage/plugin-api-docs';
import {
  EntityAboutCard,
  EntityDependsOnComponentsCard,
  EntityDependsOnResourcesCard,
  EntityHasComponentsCard,
  EntityHasResourcesCard,
  EntityHasSubcomponentsCard,
  EntityHasSystemsCard,
  EntityLayout,
  EntityLinksCard,
  EntityLabelsCard,
  EntityOrphanWarning,
  EntityProcessingErrorsPanel,
  EntitySwitch,
  hasCatalogProcessingErrors,
  isComponentType,
  isKind,
  isOrphan,
  hasLabels,
  hasRelationWarnings,
  EntityRelationWarning,
} from '@backstage/plugin-catalog';
import {
  Direction,
  EntityCatalogGraphCard,
} from '@backstage/plugin-catalog-graph';
import { EntityKubernetesContent } from '@backstage/plugin-kubernetes';
import {
  isKubernetesClusterAvailable,
  EntityKubernetesClusterContent,
} from '@backstage/plugin-kubernetes-cluster';
// Jenkins Plugin Import
import {
  EntityJenkinsContent,
  isJenkinsAvailable,
} from '@backstage-community/plugin-jenkins';
import {
  EntityGroupProfileCard,
  EntityMembersListCard,
  EntityOwnershipCard,
  EntityUserProfileCard,
} from '@backstage/plugin-org';
import Button from '@material-ui/core/Button';
import Grid from '@material-ui/core/Grid';
import { ReactNode } from 'react';
import { TechDocsAddons } from '@backstage/plugin-techdocs-react';
import {
  TextSize,
  ReportIssue,
  LightBox,
} from '@backstage/plugin-techdocs-module-addons-contrib';
import { EntityTechdocsContent } from '@backstage/plugin-techdocs';

const customEntityFilterKind = ['Component', 'API', 'System'];

const EntityLayoutWrapper = (props: { children?: ReactNode }) => {
  return (
    <EntityLayout
      parentEntityRelations={['partOf', 'memberOf', 'childOf']}
      UNSTABLE_contextMenuOptions={{
        disableUnregister: 'visible',
      }}
    >
      {props.children}
    </EntityLayout>
  );
};
import {
  EntityGithubActionsContent,
  isGithubActionsAvailable,
} from '@backstage-community/plugin-github-actions';
// ArgoCD UI
import { useEntity } from '@backstage/plugin-catalog-react';
import { useEffect, useState, useCallback } from 'react';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Typography from '@material-ui/core/Typography';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Box from '@material-ui/core/Box';
import Divider from '@material-ui/core/Divider';
import { useApi, discoveryApiRef } from '@backstage/core-plugin-api';
import Chip from '@material-ui/core/Chip';

const StatusChip = ({ status }: { status: string }) => {
  const normalized = status?.toLowerCase();

  let bgColor = '#9e9e9e';
  let textColor = '#fff';

  if (
    normalized === 'healthy' ||
    normalized === 'synced' ||
    normalized === 'succeeded'
  ) {
    bgColor = '#2e7d32'; // GREEN
  } else if (
    normalized === 'outofsync' ||
    normalized === 'degraded' ||
    normalized === 'error' ||
    normalized === 'failed'
  ) {
    bgColor = '#c62828'; // RED
  } else if (
    normalized === 'progressing' ||
    normalized === 'missing' ||
    normalized === 'unknown'
  ) {
    bgColor = '#f9a825'; // YELLOW
    textColor = '#000';
  }

  return (
    <Chip
      label={status}
      style={{
        backgroundColor: bgColor,
        color: textColor,
        fontWeight: 600,
      }}
      size="small"
    />
  );
};
const ArgoStatusCard = () => {
  const { entity } = useEntity();
  const discoveryApi = useApi(discoveryApiRef);

  const appName =
    entity.metadata.annotations?.['argocd/app-name']?.toLowerCase();

  const [data, setData] = useState<any>();
  const [error, setError] = useState<string | null>(null);
  const [serviceUrl, setServiceUrl] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const baseUrl = await discoveryApi.getBaseUrl('proxy');

      // Application data
      const response = await fetch(
        `${baseUrl}/argocd/api/v1/applications/${appName}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json();
      setData(json);

      // Resource tree (for LoadBalancer IP)
      const treeRes = await fetch(
        `${baseUrl}/argocd/api/v1/applications/${appName}/resource-tree`,
      );

      if (treeRes.ok) {
        const treeJson = await treeRes.json();

        const serviceNode = treeJson.nodes?.find(
          (n: any) => n.kind === 'Service',
        );

        const ingress = serviceNode?.networkingInfo?.ingress?.[0];

        const host = ingress?.ip || ingress?.hostname;

        if (host) {
          setServiceUrl(`http://${host}`);
        }
      }
    } catch (err: any) {
      console.error('Argo fetch error:', err);
      setError(err.message);
    }
  }, [appName, discoveryApi]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const manualSync = async () => {
    const baseUrl = await discoveryApi.getBaseUrl('proxy');
    await fetch(`${baseUrl}/argocd/api/v1/applications/${appName}/sync`, {
      method: 'POST',
    });
    fetchData();
  };

  if (!data) return <Typography>Loading ArgoCD...</Typography>;

  const status = data?.status;

  if (!status) return <Typography>No status available</Typography>;

  const renderHealthStatus = (r: any) => {
    if (r.kind === 'Application') {
      return <StatusChip status={data?.status?.health?.status ?? 'Unknown'} />;
    }

    if (r.health?.status) {
      return <StatusChip status={r.health.status} />;
    }

    return '—';
  };

  return (
    <Card elevation={4}>
      <CardContent>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h5">{appName}</Typography>
              <Box mt={1} display="flex" alignItems="center" gap={8} flexWrap="wrap">
              <StatusChip status={status.sync.status} />
              <StatusChip status={status.health.status} />
            </Box>
          </Box>
          <Box display="flex" gap={8}>
            <Button variant="contained" color="primary" onClick={manualSync}>
              Sync
            </Button>

            <Button
              variant="outlined"
              color="default"
              href={`https://35.184.124.65/applications/argocd/${appName}?view=tree&resource=`}
              target="_blank"
            >
              Open ArgoCD
            </Button>
          </Box>
        </Box>

        <Divider style={{ margin: '20px 0' }} />

        {/* Service Endpoint */}
        <Box mt={3} display="flex" alignItems="center" justifyContent="space-between" >
          <Typography variant="h6" gutterBottom>
            Service Endpoint
          </Typography>
          {serviceUrl && (
          <Button
            size="small"
            variant="contained"
            href={serviceUrl}
            target="_blank"
            style={{
              textTransform: 'none',
              fontWeight: 'bolder',
              background: '#0a4b6b',
              color: '#fff',
              borderRadius: 20,
              // padding: '2px 10px',
              minWidth: 'auto',
            }}
          >
            <Typography variant="caption">
              {serviceUrl.replace('http://', '')} ↗
            </Typography>
          </Button>
        )}
        </Box>

        <Divider style={{ margin: '20px 0' }} />

        {/* Revision */}
        <Box mt={3}>
          <Typography variant="h6" gutterBottom>
            Revision
          </Typography>

          <Chip
            label={status.sync.revision?.slice(0, 7)}
            size="small"
            style={{
              marginTop: 6,
              backgroundColor: '#0a4b6b',
              color: '#fff',
              fontFamily: 'monospace',
              fontWeight: 600,
            }}
          />
        </Box>
        <Divider style={{ margin: '20px 0' }} />

        {/* Resources Table */}
        <Typography variant="h6" gutterBottom>
          Resources
        </Typography>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Kind</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Health</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {status.resources.map((r: any) => (
              <TableRow key={r.name}>
                <TableCell>{r.kind}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>
                  <StatusChip status={r.status} />
                </TableCell>
                <TableCell>{renderHealthStatus(r)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Divider style={{ margin: '20px 0' }} />

        {/* Deployment Timeline */}
        <Box mt={3}>
          <Typography variant="h6" gutterBottom>
            Deployment History
          </Typography>

          {status.history.slice(0, 5).map((h: any) => (
            <Box
              key={h.id}
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              p={1.5}
              mb={1}
              borderRadius={6}
            >
              <Chip
                label={h.revision.slice(0, 7)}
                size="small"
                style={{
                  fontFamily: 'monospace',
                  backgroundColor: '#0a4b6b',
                  color: '#fff',
                }}
              />

              <Typography variant="caption" color="textSecondary">
                {new Date(h.deployedAt).toLocaleString()}
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

 

const techdocsContent = (
  <EntityTechdocsContent>
    <TechDocsAddons>
      <TextSize />
      <ReportIssue />
      <LightBox />
    </TechDocsAddons>
  </EntityTechdocsContent>
);

/**
 * NOTE: This page is designed to work on small screens such as mobile devices.
 * This is based on Material UI Grid. If breakpoints are used, each grid item must set the `xs` prop to a column size or to `true`,
 * since this does not default. If no breakpoints are used, the items will equitably share the available space.
 * https://material-ui.com/components/grid/#basic-grid.
 */

const cicdContent = (
  <EntitySwitch>
    {/* Jenkins: show builds when jenkins.io/job-full-name is present */}
    <EntitySwitch.Case if={isJenkinsAvailable}>
      <EntityJenkinsContent />
    </EntitySwitch.Case>

    {/* Fallback: no CI/CD annotation */}
    <EntitySwitch.Case>
      <EmptyState
        title="No CI/CD available for this entity"
        missing="info"
        description="To enable CI/CD for this component, configure a Jenkins job and add the jenkins.io/job-full-name annotation to its catalog-info.yaml."
        action={
          <Button
            variant="contained"
            color="primary"
            href="https://backstage.io/docs/features/software-catalog/well-known-annotations"
          >
            Read more
          </Button>
        }
      />
    </EntitySwitch.Case>
  </EntitySwitch>
);

const entityWarningContent = (
  <>
    <EntitySwitch>
      <EntitySwitch.Case if={isOrphan}>
        <Grid item xs={12}>
          <EntityOrphanWarning />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>

    <EntitySwitch>
      <EntitySwitch.Case if={hasRelationWarnings}>
        <Grid item xs={12}>
          <EntityRelationWarning />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>

    <EntitySwitch>
      <EntitySwitch.Case if={hasCatalogProcessingErrors}>
        <Grid item xs={12}>
          <EntityProcessingErrorsPanel />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
  </>
);

const overviewContent = (
  <Grid container spacing={3} alignItems="stretch">
    {entityWarningContent}
    <Grid item md={6} xs={12}>
      <EntityAboutCard variant="gridItem" />
    </Grid>

    <Grid item md={6} xs={12}>
      <EntityCatalogGraphCard variant="gridItem" height={400} />
    </Grid>

    <Grid item md={4} xs={12}>
      <EntityLinksCard />
    </Grid>

    <EntitySwitch>
      <EntitySwitch.Case if={hasLabels}>
        <Grid item md={4} xs={12}>
          <EntityLabelsCard />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>

    <Grid item md={8} xs={12}>
      <EntityHasSubcomponentsCard variant="gridItem" />
    </Grid>
  </Grid>
);

const serviceEntityPage = (
  <EntityLayoutWrapper>
    <EntityLayout.Route path="/" title="Overview">
      {overviewContent}
    </EntityLayout.Route>

    <EntityLayout.Route path="/ci-cd" title="CI/CD">
      {cicdContent}
    </EntityLayout.Route>
    <EntityLayout.Route path="/argocd" title="Argo CD">
      <ArgoStatusCard />
    </EntityLayout.Route>
    <EntityLayout.Route
      path="/github-actions"
      title="GitHub Actions"
      if={isGithubActionsAvailable}
    >
      <EntityGithubActionsContent />
    </EntityLayout.Route>

    <EntityLayout.Route path="/api" title="API">
      <Grid container spacing={3} alignItems="stretch">
        <Grid item xs={12} md={6}>
          <EntityProvidedApisCard />
        </Grid>
        <Grid item xs={12} md={6}>
          <EntityConsumedApisCard />
        </Grid>
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route path="/dependencies" title="Dependencies">
      <Grid container spacing={3} alignItems="stretch">
        <Grid item xs={12} md={6}>
          <EntityDependsOnComponentsCard variant="gridItem" />
        </Grid>
        <Grid item xs={12} md={6}>
          <EntityDependsOnResourcesCard variant="gridItem" />
        </Grid>
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route path="/docs" title="Docs">
      {techdocsContent}
    </EntityLayout.Route>

    <EntityLayout.Route path="/kubernetes" title="Kubernetes">
      <EntityKubernetesContent />
    </EntityLayout.Route>
  </EntityLayoutWrapper>
);

const websiteEntityPage = (
  <EntityLayoutWrapper>
    <EntityLayout.Route path="/" title="Overview">
      {overviewContent}
    </EntityLayout.Route>

    <EntityLayout.Route path="/ci-cd" title="CI/CD">
      {cicdContent}
    </EntityLayout.Route>

    <EntityLayout.Route path="/dependencies" title="Dependencies">
      <Grid container spacing={3} alignItems="stretch">
        <Grid item md={6}>
          <EntityDependsOnComponentsCard variant="gridItem" />
        </Grid>
        <Grid item md={6}>
          <EntityDependsOnResourcesCard variant="gridItem" />
        </Grid>
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route path="/docs" title="Docs">
      {techdocsContent}
    </EntityLayout.Route>

    <EntityLayout.Route path="/kubernetes" title="Kubernetes">
      <EntityKubernetesContent />
    </EntityLayout.Route>
  </EntityLayoutWrapper>
);

const defaultEntityPage = (
  <EntityLayoutWrapper>
    <EntityLayout.Route path="/" title="Overview">
      {overviewContent}
    </EntityLayout.Route>

    <EntityLayout.Route path="/docs" title="Docs">
      {techdocsContent}
    </EntityLayout.Route>
    <EntityLayout.Route path="/ci-cd" title="CI/CD">
      {cicdContent}
    </EntityLayout.Route>
  </EntityLayoutWrapper>
);

const componentPage = (
  <EntitySwitch>
    <EntitySwitch.Case if={isComponentType('service')}>
      {serviceEntityPage}
    </EntitySwitch.Case>

    <EntitySwitch.Case if={isComponentType('website')}>
      {websiteEntityPage}
    </EntitySwitch.Case>

    <EntitySwitch.Case>{defaultEntityPage}</EntitySwitch.Case>
  </EntitySwitch>
);

const apiPage = (
  <EntityLayoutWrapper>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3}>
        {entityWarningContent}
        <Grid item md={6} xs={12}>
          <EntityAboutCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard variant="gridItem" height={400} />
        </Grid>
        <Grid item xs={12}>
          <Grid container>
            <Grid item xs={12} md={6}>
              <EntityProvidingComponentsCard />
            </Grid>
            <Grid item xs={12} md={6}>
              <EntityConsumingComponentsCard />
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route path="/definition" title="Definition">
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <EntityApiDefinitionCard />
        </Grid>
      </Grid>
    </EntityLayout.Route>
  </EntityLayoutWrapper>
);

const userPage = (
  <EntityLayoutWrapper>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3}>
        {entityWarningContent}
        <Grid item xs={12} md={6}>
          <EntityUserProfileCard variant="gridItem" />
        </Grid>
        <Grid item xs={12} md={6}>
          <EntityOwnershipCard
            variant="gridItem"
            entityFilterKind={customEntityFilterKind}
          />
        </Grid>
      </Grid>
    </EntityLayout.Route>
  </EntityLayoutWrapper>
);

const groupPage = (
  <EntityLayoutWrapper>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3}>
        {entityWarningContent}
        <Grid item xs={12} md={6}>
          <EntityGroupProfileCard variant="gridItem" />
        </Grid>
        <Grid item xs={12} md={6}>
          <EntityOwnershipCard
            variant="gridItem"
            entityFilterKind={customEntityFilterKind}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <EntityMembersListCard />
        </Grid>
        <Grid item xs={12} md={6}>
          <EntityLinksCard />
        </Grid>
      </Grid>
    </EntityLayout.Route>
  </EntityLayoutWrapper>
);

const systemPage = (
  <EntityLayoutWrapper>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard variant="gridItem" height={400} />
        </Grid>
        <Grid item md={6}>
          <EntityHasComponentsCard variant="gridItem" />
        </Grid>
        <Grid item md={6}>
          <EntityHasApisCard variant="gridItem" />
        </Grid>
        <Grid item md={6}>
          <EntityHasResourcesCard variant="gridItem" />
        </Grid>
      </Grid>
    </EntityLayout.Route>
    <EntityLayout.Route path="/diagram" title="Diagram">
      <EntityCatalogGraphCard
        variant="gridItem"
        direction={Direction.TOP_BOTTOM}
        title="System Diagram"
        height={700}
        relations={[
          RELATION_PART_OF,
          RELATION_HAS_PART,
          RELATION_API_CONSUMED_BY,
          RELATION_API_PROVIDED_BY,
          RELATION_CONSUMES_API,
          RELATION_PROVIDES_API,
          RELATION_DEPENDENCY_OF,
          RELATION_DEPENDS_ON,
        ]}
        unidirectional={false}
      />
    </EntityLayout.Route>
  </EntityLayoutWrapper>
);

const domainPage = (
  <EntityLayoutWrapper>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard variant="gridItem" height={400} />
        </Grid>
        <Grid item md={6}>
          <EntityHasSystemsCard variant="gridItem" />
        </Grid>
      </Grid>
    </EntityLayout.Route>
  </EntityLayoutWrapper>
);

const resourcePage = (
  <EntityLayoutWrapper>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard variant="gridItem" height={400} />
        </Grid>
        <Grid item md={6}>
          <EntityHasSystemsCard variant="gridItem" />
        </Grid>
      </Grid>
    </EntityLayout.Route>
    <EntityLayout.Route
      path="/kubernetes-cluster"
      title="Kubernetes Cluster"
      if={isKubernetesClusterAvailable}
    >
      <EntityKubernetesClusterContent />
    </EntityLayout.Route>
  </EntityLayoutWrapper>
);

export const entityPage = (
  <EntitySwitch>
    <EntitySwitch.Case if={isKind('component')} children={componentPage} />
    <EntitySwitch.Case if={isKind('api')} children={apiPage} />
    <EntitySwitch.Case if={isKind('group')} children={groupPage} />
    <EntitySwitch.Case if={isKind('user')} children={userPage} />
    <EntitySwitch.Case if={isKind('system')} children={systemPage} />
    <EntitySwitch.Case if={isKind('domain')} children={domainPage} />
    <EntitySwitch.Case if={isKind('resource')} children={resourcePage} />

    <EntitySwitch.Case>{defaultEntityPage}</EntitySwitch.Case>
  </EntitySwitch>
);
